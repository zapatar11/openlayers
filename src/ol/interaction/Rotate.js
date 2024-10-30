/**
 * @module ol/interaction/Rotate
 */
import Collection from '../Collection.js';
import Event from '../events/Event.js';
import Feature from '../Feature.js';
import InteractionProperty from './Property.js';
import PointerInteraction from './Pointer.js';
import {TRUE} from '../functions.js';
import {always} from '../events/condition.js';
// import {fromUserCoordinate, getUserProjection} from '../proj.js';
//import VectorLayer from '../layer/Vector.js';
import VectorSource from '../source/Vector.js';
import {Point} from '../geom.js';

/**
 * @enum {string}
 */
const RotateEventType = {
  /**
   * Triggered upon feature rotation start.
   * @event RotateEvent#rotatestart
   * @api
   */
  ROTATESTART: 'rotatestart',
  /**
   * Triggered upon feature rotation.
   * @event RotateEvent#rotating
   * @api
   */
  ROTATING: 'rotating',
  /**
   * Triggered upon feature rotation end.
   * @event RotateEvent#rotateend
   * @api
   */
  ROTATEEND: 'rotateend',
};

/**
 * A function that takes a {@link module:ol/Feature~Feature} or
 * {@link module:ol/render/Feature~RenderFeature} and a
 * {@link module:ol/layer/Layer~Layer} and returns `true` if the feature may be
 * rotated or `false` otherwise.
 * @typedef {function(Feature, import("../layer/Layer.js").default<import("../source/Source.js").default>):boolean} FilterFunction
 */

/**
 * @typedef {Object} Options
 * @property {import("../events/condition.js").Condition} [condition] A function that
 * takes a {@link module:ol/MapBrowserEvent~MapBrowserEvent} and returns a
 * boolean to indicate whether that event should be handled.
 * Default is {@link module:ol/events/condition.always}.
 * @property {Collection<Feature>} [features] Features contained in this collection will be able to be rotated together.
 * @property {Array<import("../layer/Layer.js").default>|function(import("../layer/Layer.js").default<import("../source/Source.js").default>): boolean} [layers] A list of layers from which features should be
 * rotated. Alternatively, a filter function can be provided. The
 * function will be called for each layer in the map and should return
 * `true` for layers that you want to be rotable. If the option is
 * absent, all visible layers will be considered rotable.
 * Not used if `features` is provided.
 * @property {FilterFunction} [filter] A function
 * that takes a {@link module:ol/Feature~Feature} and an
 * {@link module:ol/layer/Layer~Layer} and returns `true` if the feature may be
 * rotated or `false` otherwise. Not used if `features` is provided.
 * @property {number} [hitTolerance=0] Hit-detection tolerance. Pixels inside the radius around the given position
 * will be checked for features.
 */

/**
 * @classdesc
 * Events emitted by {@link module:ol/interaction/Rotate~Rotate} instances
 * are instances of this type.
 */
export class RotateEvent extends Event {
  /**
   * @param {RotateEventType} type Type.
   * @param {Collection<Feature>} features The features rotated.
   * @param {import("../coordinate.js").Coordinate} coordinate The event coordinate.
   * @param {import("../coordinate.js").Coordinate} startCoordinate The original coordinates before.rotation started
   * @param {import("../MapBrowserEvent.js").default} mapBrowserEvent Map browser event.
   */
  constructor(type, features, coordinate, startCoordinate, mapBrowserEvent) {
    super(type);

    /**
     * The features being rotated.
     * @type {Collection<Feature>}
     * @api
     */
    this.features = features;

    /**
     * The coordinate of the drag event.
     * @const
     * @type {import("../coordinate.js").Coordinate}
     * @api
     */
    this.coordinate = coordinate;

    /**
     * The coordinate of the start position before rotation started.
     * @const
     * @type {import("../coordinate.js").Coordinate}
     * @api
     */
    this.startCoordinate = startCoordinate;

    /**
     * Associated {@link module:ol/MapBrowserEvent~MapBrowserEvent}.
     * @type {import("../MapBrowserEvent.js").default}
     * @api
     */
    this.mapBrowserEvent = mapBrowserEvent;
  }
}

/***
 * @template Return
 * @typedef {import("../Observable.js").OnSignature<import("../Observable.js").EventTypes, import("../events/Event.js").default, Return> &
 *   import("../Observable.js").OnSignature<import("../ObjectEventType.js").Types|
 *     'change:active', import("../Object.js").ObjectEvent, Return> &
 *   import("../Observable.js").OnSignature<'rotateend'|'rotatestart'|'rotating', RotateEvent, Return> &
 *   import("../Observable.js").CombinedOnSignature<import("../Observable.js").EventTypes|import("../ObjectEventType.js").Types|
 *     'change:active'|'rotateend'|'rotatestart'|'rotating', Return>} RotateOnSignature
 */

/**
 * @classdesc
 * Interaction for rotating (moving) features.
 * If you want to rotate multiple features in a single action (for example,
 * the collection used by a select interaction), construct the interaction with
 * the `features` option.
 *
 * @fires RotateEvent
 * @api
 */
class Rotate extends PointerInteraction {
  /**
   * @param {Options} [options] Options.
   */
  constructor(options) {
    options = options ? options : {};

    super(/** @type {import("./Pointer.js").Options} */ (options));

    /***
     * @type {RotateOnSignature<import("../events.js").EventsKey>}
     */
    this.on;

    /***
     * @type {RotateOnSignature<import("../events.js").EventsKey>}
     */
    this.once;

    /***
     * @type {RotateOnSignature<void>}
     */
    this.un;

    /**
     * The last position we rotated to.
     * @type {import("../coordinate.js").Coordinate}
     * @private
     */
    this.lastCoordinate_ = null;

    /**
     * The start position before rotation started.
     * @type {import("../coordinate.js").Coordinate}
     * @private
     */
    this.startCoordinate_ = null;

    /**
     * @type {Collection<Feature>|null}
     * @private
     */
    this.features_ = options.features !== undefined ? options.features : null;

    /** @type {function(import("../layer/Layer.js").default<import("../source/Source.js").default>): boolean} */
    let layerFilter;
    if (options.layers && !this.features_) {
      if (typeof options.layers === 'function') {
        layerFilter = options.layers;
      } else {
        const layers = options.layers;
        layerFilter = function (layer) {
          return layers.includes(layer);
        };
      }
    } else {
      layerFilter = TRUE;
    }

    /**
     * @private
     * @type {function(import("../layer/Layer.js").default<import("../source/Source.js").default>): boolean}
     */
    this.layerFilter_ = layerFilter;

    /**
     * @private
     * @type {FilterFunction}
     */
    this.filter_ = options.filter && !this.features_ ? options.filter : TRUE;

    /**
     * @private
     * @type {number}
     */
    this.hitTolerance_ = options.hitTolerance ? options.hitTolerance : 0;

    /**
     * @private
     * @type {import("../events/condition.js").Condition}
     */
    this.condition_ = options.condition ? options.condition : always;

    /**
     * @type {Feature}
     * @private
     */
    this.lastFeature_ = null;

    /**
     * @type {Feature}
     * @private
     */
    this.pivote_1 = new Feature({});
    /**
     * @type {Feature}
     * @private
     */
    this.pivote_2 = new Feature({});

    /**
     * @type {VectorSource}
     * @private
     */
    this.source_cartodi_pivote_ = options.pivote ? options.pivote : null;
    // options.pivote.addFeature(this.pivote_1);

    // this.source_cartodi_pivote2_ = options.pivote2 ? options.pivote2 : null;
    // console.log(options);
    // options.pivote2.addFeature(this.pivote_2);
    /**
     * The last position we rotated to.
     * @type {import("../coordinate.js").Coordinate}
     * @private
     */
    this.coordinate_ = null;
    /**
     * @type {Object}
     * @private
     */
    this.cartodi = options.cartodi;

    /**
     * @type {boolean}
     * @private
     */
    this.first_ = true;

    this.addChangeListener(
      InteractionProperty.ACTIVE,
      this.handleActiveChanged_,
    );
  }

  /**
   * Handle pointer down events.
   * @param {import("../MapBrowserEvent.js").default} event Event.
   * @return {boolean} If the event was consumed.
   * @override
   */
  handleDownEvent(event) {
    if (!event.originalEvent || !this.condition_(event)) {
      return false;
    }
    this.coordinate_ = event.coordinate;
    this.lastFeature_ = this.featuresAtPixel_(event.pixel, event.map);
    if (!this.lastCoordinate_ && this.lastFeature_) {
      this.startCoordinate_ = event.coordinate;
      this.lastCoordinate_ = event.coordinate;
      this.handleMoveEvent(event);

      const features = this.features_ || new Collection([this.lastFeature_]);

      this.dispatchEvent(
        new RotateEvent(
          RotateEventType.ROTATESTART,
          features,
          event.coordinate,
          this.startCoordinate_,
          event,
        ),
      );
      return true;
    }
    return false;
  }

  /**
   * Handle pointer up events.
   * @param {import("../MapBrowserEvent.js").default} event Event.
   * @return {boolean} If the event was consumed.
   * @override
   */
  handleUpEvent(event) {
    this.coordinate_ = null;
    this.feature_ = null;
    const features = this.features_ || new Collection([this.lastFeature_]);
    const featuresEdit = features.getArray();
    for (const x in featuresEdit) {
      const id = featuresEdit[x].getId();
      if (id !== 'PIVOTE_1_ID') {
        this.cartodi.feature_original[id] = featuresEdit[x].clone();
      }
    }
    if (this.lastCoordinate_) {
      this.lastCoordinate_ = null;
      this.handleMoveEvent(event);

      //   const features = this.features_ || new Collection([this.lastFeature_]);

      this.dispatchEvent(
        new RotateEvent(
          RotateEventType.ROTATEEND,
          features,
          event.coordinate,
          this.startCoordinate_,
          event,
        ),
      );
      // cleanup
      this.startCoordinate_ = null;
      return true;
    }
    return false;
  }

  /**
   * Handle pointer drag events.
   * @param {import("../MapBrowserEvent.js").default} event Event.
   * @override
   */
  handleDragEvent(event) {
    if (this.lastCoordinate_) {
      const newCoordinate = event.coordinate;
      //   const projection = event.map.getView().getProjection();

      //   const newViewCoordinate = fromUserCoordinate(newCoordinate, projection);
      //   const lastViewCoordinate = fromUserCoordinate(
      //     this.lastCoordinate_,
      //     projection,
      //   );
      //   const deltaX = newViewCoordinate[0] - lastViewCoordinate[0];
      //   const deltaY = newViewCoordinate[1] - lastViewCoordinate[1];

      const centroide = this.pivote_1.getGeometry().getCoordinates();
      // const pivote2 = this.pivote_2.getGeometry().getCoordinates();

      const angulo_inicial = this.getAzimut(centroide, this.coordinate_);
      const angulo = this.getAzimut(centroide, newCoordinate);

      const angulo_final = (angulo_inicial - angulo) * -1;
      const angulo_en_radiane = (angulo_final * Math.PI) / -180;
      // if (angulo > 180) {
      //   const aux = angulo - 180;
      //   let angulo_show = 180 - aux;
      //   angulo_show = angulo_show * -1;
      // } else {
      //   const angulo_show = angulo;
      // }

      const features = this.features_ || new Collection([this.lastFeature_]);
      //   const userProjection = getUserProjection();

      const featuresEdit = features.getArray();
      const llaves = Object.keys(this.cartodi.feature_original);
      for (const x in featuresEdit) {
        const id = featuresEdit[x].getId();
        if (id == 'PIVOTE_1_ID') {
          continue;
        }
        //if($.inArray(id,llaves) != -1){
        // if(ol.array.includes(llaves,id) ){
        if (llaves.includes(id)) {
          featuresEdit[x].setGeometry(
            this.cartodi.feature_original[id].getGeometry().clone(),
          );
        } else {
          this.cartodi.feature_original[id] = featuresEdit[x].clone();
        }
        const geometria = featuresEdit[x].getGeometry();
        this.cartodi.predioEdicionSelected[id] = featuresEdit[x];

        // if (userProjection) {
        //   geometria.transform(userProjection, projection);
        //   geometria.rotate(angulo_en_radiane, centroide);
        //   geometria.transform(projection, userProjection);
        // } else {
        // }
        geometria.rotate(angulo_en_radiane, centroide);
        featuresEdit[x].setGeometry(geometria);
      }

      //   features.forEach(function (feature) {
      //     const geom = feature.getGeometry();
      //     if (userProjection) {
      //       geom.transform(userProjection, projection);
      //       geom.translate(deltaX, deltaY);
      //       geom.transform(projection, userProjection);
      //     } else {
      //       geom.translate(deltaX, deltaY);
      //     }
      //     feature.setGeometry(geom);
      //   });

      this.lastCoordinate_ = newCoordinate;

      this.dispatchEvent(
        new RotateEvent(
          RotateEventType.ROTATING,
          features,
          newCoordinate,
          this.startCoordinate_,
          event,
        ),
      );
    }
  }

  /**
   * Handle pointer move events.
   * @param {import("../MapBrowserEvent.js").default} event Event.
   * @override
   */
  handleMoveEvent(event) {
    const elem = event.map.getViewport();

    // Change the cursor to grab/grabbing if hovering any of the features managed
    // by the interaction
    if (this.featuresAtPixel_(event.pixel, event.map)) {
      elem.classList.remove(this.lastCoordinate_ ? 'ol-grab' : 'ol-grabbing');
      elem.classList.add(this.lastCoordinate_ ? 'ol-grabbing' : 'ol-grab');
    } else {
      elem.classList.remove('ol-grab', 'ol-grabbing');
    }
  }

  /**
   * Tests to see if the given coordinates intersects any of our selected
   * features.
   * @param {import("../pixel.js").Pixel} pixel Pixel coordinate to test for intersection.
   * @param {import("../Map.js").default} map Map to test the intersection on.
   * @return {Feature} Returns the feature found at the specified pixel
   * coordinates.
   * @private
   */
  featuresAtPixel_(pixel, map) {
    return map.forEachFeatureAtPixel(
      pixel,
      (feature, layer) => {
        if (!(feature instanceof Feature) || !this.filter_(feature, layer)) {
          return undefined;
        }
        if (this.features_ && !this.features_.getArray().includes(feature)) {
          return undefined;
        }
        return feature;
      },
      {
        layerFilter: this.layerFilter_,
        hitTolerance: this.hitTolerance_,
      },
    );
  }

  /**
   * Returns the Hit-detection tolerance.
   * @return {number} Hit tolerance in pixels.
   * @api
   */
  getHitTolerance() {
    return this.hitTolerance_;
  }

  /**
   * Hit-detection tolerance. Pixels inside the radius around the given position
   * will be checked for features.
   * @param {number} hitTolerance Hit tolerance in pixels.
   * @api
   */
  setHitTolerance(hitTolerance) {
    this.hitTolerance_ = hitTolerance;
  }

  /**
   * Remove the interaction from its current map and attach it to the new map.
   * Subclasses may set up event handlers to get notified about changes to
   * the map here.
   * @param {import("../Map.js").default} map Map.
   * @override
   */
  setMap(map) {
    const oldMap = this.getMap();
    super.setMap(map);
    this.updateState_(oldMap);
  }

  /**
   * @private
   */
  handleActiveChanged_() {
    this.updateState_(null);
  }

  /**
   * @param {import("../Map.js").default} oldMap Old map.
   * @private
   */
  updateState_(oldMap) {
    let map = this.getMap();
    const active = this.getActive();
    if (!map || !active) {
      map = map || oldMap;
      if (map) {
        const elem = map.getViewport();
        elem.classList.remove('ol-grab', 'ol-grabbing');
      }
    }
  }

  getCenterOfExtent(Extent) {
    const X = Extent[0] + (Extent[2] - Extent[0]) / 2;
    const Y = Extent[1] + (Extent[3] - Extent[1]) / 2;
    return [X, Y];
  }
  refreshFeaturesPivotes() {
    const features = this.features_ || new Collection([this.lastFeature_]);

    const newsource = new VectorSource();

    newsource.addFeatures(features.getArray());

    const extent = newsource.getExtent();
    const centro = this.getCenterOfExtent(extent);

    const punto1 = new Point(centro);

    this.pivote_1.setGeometry(punto1);
    this.pivote_1.setId('PIVOTE_1_ID');

    const pivote1 = this.source_cartodi_pivote_;
    pivote1.addFeature(this.pivote_1);

    if (this.first_) {
      //   this.features_.push(this.pivote_2);
      this.first_ = false;
    }
  }
  getPointFromDirection(coordinateOrigen, angulo, distancia) {
    const x = coordinateOrigen[0];
    const y = coordinateOrigen[1];
    let teta = angulo;
    const h = distancia;

    if (angulo < 0) {
      //En caso de que introduzcan angulos negativos
      //Como es negativo se restará
      teta = 360 + angulo;
    }
    //El angulo es una vuelta completa retornando al punto de inicio
    if (angulo == 360) {
      teta = 0;
    }

    //Ajustamos el angulo para realizar las operaciones
    if (teta >= 0 && teta <= 90) {
      teta = 90 - teta;
    } else if (teta > 90 && teta <= 180) {
      teta = 360 - teta + 90;
    } else if (teta > 180 && teta <= 270) {
      teta = 270 - teta + 180;
    } else if (teta > 270 && teta < 360) {
      teta = 180 - teta + 270;
    }
    //Convertimos angulos a radianes
    teta = (teta * Math.PI) / 180;
    const x2 = x + Math.cos(teta) * h;
    let y2 = Math.tan(teta) * (x2 - x) + y;

    //En caso de que el eje y haya quedado en el origen
    if (Math.tan(teta) * (x2 - x) == 0) {
      if (angulo == 360 || angulo == 0) {
        y2 = y + distancia;
      } else if (angulo == 180) {
        y2 = y - distancia;
      }
    }
    const coordinateResult = [x2, y2];
    return coordinateResult;
  }
  getAzimut(coordinate1, coordinate2) {
    const x1 = coordinate1[0];
    const y1 = coordinate1[1];

    const x2 = coordinate2[0];
    const y2 = coordinate2[1];

    let azimut = 0;

    const dx = x2 - x1;
    const dy = y2 - y1;

    const Az2 = Math.atan(dx / dy);

    if (dx > 0 && dy > 0) {
      //Primer Cuadrante
      azimut = Az2;
    } else if (dx > 0 && dy < 0) {
      //Cuarto Cuadrante
      azimut = Az2 + Math.PI;
    } else if (dx < 0 && dy < 0) {
      //Tercer Cuadrante
      azimut = Az2 + Math.PI;
    } else if (dx < 0 && dy > 0) {
      //Segundo Cuadrante
      azimut = Az2 + 2 * Math.PI;
    }

    const azimutAng = (azimut * 180) / Math.PI;

    return azimutAng;
  }
}

export default Rotate;
