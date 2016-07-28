/*
 Leaflet.draw, a plugin that adds drawing and editing tools to Leaflet powered maps.
 (c) 2012-2016, Jacob Toye, Smartrak, Leaflet

 https://github.com/Leaflet/Leaflet.draw
 http://leafletjs.com
 */
(function (window, document, undefined) {/*
 * Leaflet.draw assumes that you have already included the Leaflet library.
 */

L.drawVersion = '0.3.0-dev';

L.drawLocal = {
  draw: {
    toolbar: {
      // #TODO: this should be reorganized where actions are nested in actions
      // ex: actions.undo  or actions.cancel
      actions: {
        title: 'Cancel drawing',
        text: 'Cancel'
      },
      finish: {
        title: 'Finish drawing',
        text: 'Finish'
      },
      undo: {
        title: 'Delete last point drawn',
        text: 'Delete last point'
      },
      buttons: {
        polyline: 'Draw a polyline',
        polygon: 'Draw a polygon',
        rectangle: 'Draw a rectangle',
        circle: 'Draw a circle',
        marker: 'Draw a marker'
      }
    },
    handlers: {
      circle: {
        tooltip: {
          start: 'Click and drag to draw circle.'
        },
        radius: 'Radius'
      },
      marker: {
        tooltip: {
          start: 'Click map to place marker.'
        }
      },
      polygon: {
        tooltip: {
          start: 'Click to start drawing shape.',
          cont: 'Click to continue drawing shape.',
          end: 'Click first point to close this shape.'
        }
      },
      polyline: {
        error: '<strong>Error:</strong> shape edges cannot cross!',
        tooltip: {
          start: 'Click to start drawing line.',
          cont: 'Click to continue drawing line.',
          end: 'Click last point to finish line.'
        }
      },
      rectangle: {
        tooltip: {
          start: 'Click and drag to draw rectangle.'
        }
      },
      simpleshape: {
        tooltip: {
          end: 'Release mouse to finish drawing.'
        }
      }
    }
  },
  edit: {
    toolbar: {
      actions: {
        save: {
          title: 'Save changes.',
          text: 'Save'
        },
        cancel: {
          title: 'Cancel editing, discards all changes.',
          text: 'Cancel'
        }
      },
      buttons: {
        edit: 'Edit layers.',
        editDisabled: 'No layers to edit.',
        remove: 'Delete layers.',
        removeDisabled: 'No layers to delete.'
      }
    },
    handlers: {
      edit: {
        tooltip: {
          text: 'Drag handles, or marker to edit feature.',
          subtext: 'Click cancel to undo changes.'
        }
      },
      remove: {
        tooltip: {
          text: 'Click on a feature to remove'
        }
      }
    }
  }
};


L.Draw = {};

L.Draw.Feature = L.Handler.extend({
  includes: L.Mixin.Events,

  initialize: function (map, options) {
    this._map = map;
    this._container = map._container;
    this._overlayPane = map._panes.overlayPane;
    this._popupPane = map._panes.popupPane;

    // Merge default shapeOptions options with custom shapeOptions
    if (options && options.shapeOptions) {
      options.shapeOptions = L.Util.extend({}, this.options.shapeOptions, options.shapeOptions);
    }
    L.setOptions(this, options);
  },

  enable: function () {
    if (this._enabled) {
      return;
    }

    L.Handler.prototype.enable.call(this);

    this.fire('enabled', {handler: this.type});

    this._map.fire('draw:drawstart', {layerType: this.type});
  },

  disable: function () {
    if (!this._enabled) {
      return;
    }

    L.Handler.prototype.disable.call(this);

    this._map.fire('draw:drawstop', {layerType: this.type});

    this.fire('disabled', {handler: this.type});
  },

  addHooks: function () {
    var map = this._map;

    if (map) {
      L.DomUtil.disableTextSelection();

      map.getContainer().focus();

      this._tooltip = new L.Tooltip(this._map);

      L.DomEvent.on(this._container, 'keyup', this._cancelDrawing, this);
    }
  },

  removeHooks: function () {
    if (this._map) {
      L.DomUtil.enableTextSelection();

      this._tooltip.dispose();
      this._tooltip = null;

      L.DomEvent.off(this._container, 'keyup', this._cancelDrawing, this);
    }
  },

  setOptions: function (options) {
    L.setOptions(this, options);
  },

  _fireCreatedEvent: function (layer) {
    this._map.fire('draw:created', {layer: layer, layerType: this.type});
  },

  // Cancel drawing when the escape key is pressed
  _cancelDrawing: function (e) {
    if (e.keyCode === 27) {
      this.disable();
    }
  }
});

L.Draw.Marker = L.Draw.Feature.extend({
  statics: {
    TYPE: 'marker'
  },

  options: {
    icon: new L.Icon.Default(),
    repeatMode: false,
    zIndexOffset: 2000 // This should be > than the highest z-index any markers
  },

  initialize: function (map, options) {
    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
    this.type = L.Draw.Marker.TYPE;

    L.Draw.Feature.prototype.initialize.call(this, map, options);
  },

  addHooks: function () {
    L.Draw.Feature.prototype.addHooks.call(this);

    if (this._map) {
      this._tooltip.updateContent({text: L.drawLocal.draw.handlers.marker.tooltip.start});

      // Same mouseMarker as in Draw.Polyline
      if (!this._mouseMarker) {
        this._mouseMarker = L.marker(this._map.getCenter(), {
          icon: L.divIcon({
            className: 'leaflet-mouse-marker',
            iconAnchor: [20, 20],
            iconSize: [40, 40]
          }),
          opacity: 0,
          zIndexOffset: this.options.zIndexOffset
        });
      }

      this._mouseMarker
          .on('click', this._onClick, this)
          .addTo(this._map);

      this._map.on('mousemove', this._onMouseMove, this);
      this._map.on('click', this._onTouch, this);
    }
  },

  removeHooks: function () {
    L.Draw.Feature.prototype.removeHooks.call(this);

    if (this._map) {
      if (this._marker) {
        this._marker.off('click', this._onClick, this);
        this._map
            .off('click', this._onClick, this)
            .off('click', this._onTouch, this)
            .removeLayer(this._marker);
        delete this._marker;
      }

      this._mouseMarker.off('click', this._onClick, this);
      this._map.removeLayer(this._mouseMarker);
      delete this._mouseMarker;

      this._map.off('mousemove', this._onMouseMove, this);
    }
  },

  _onMouseMove: function (e) {
    var latlng = e.latlng;

    this._tooltip.updatePosition(latlng);
    this._mouseMarker.setLatLng(latlng);

    if (!this._marker) {
      this._marker = new L.Marker(latlng, {
        icon: this.options.icon,
        zIndexOffset: this.options.zIndexOffset
      });
      // Bind to both marker and map to make sure we get the click event.
      this._marker.on('click', this._onClick, this);
      this._map
          .on('click', this._onClick, this)
          .addLayer(this._marker);
    }
    else {
      latlng = this._mouseMarker.getLatLng();
      this._marker.setLatLng(latlng);
    }
  },

  _onClick: function () {
    this._fireCreatedEvent();

    this.disable();
    if (this.options.repeatMode) {
      this.enable();
    }
  },

  _onTouch: function (e) {
    // called on click & tap, only really does any thing on tap
    this._onMouseMove(e); // creates & places marker
    this._onClick(); // permanently places marker & ends interaction
  },

  _fireCreatedEvent: function () {
    var marker = new L.Marker.Touch(this._marker.getLatLng(), {icon: this.options.icon, buttonId: this.buttonId});
   this.fire('draw:hideButton', {buttonId: this.buttonId});
    L.Draw.Feature.prototype._fireCreatedEvent.call(this, marker);
  }
});


L.Edit = L.Edit || {};

L.Edit.Marker = L.Handler.extend({
  initialize: function (marker, options) {
    this._marker = marker;
    L.setOptions(this, options);
  },

  addHooks: function () {
    var marker = this._marker;

    marker.dragging.enable();
    marker.on('dragend', this._onDragEnd, marker);
    this._toggleMarkerHighlight();
  },

  removeHooks: function () {
    var marker = this._marker;

    marker.dragging.disable();
    marker.off('dragend', this._onDragEnd, marker);
    this._toggleMarkerHighlight();
  },

  _onDragEnd: function (e) {
    var layer = e.target;
    layer.edited = true;
    this._map.fire('draw:editmove', {layer: layer});
  },

  _toggleMarkerHighlight: function () {
    var icon = this._marker._icon;


    // Don't do anything if this layer is a marker but doesn't have an icon. Markers
    // should usually have icons. If using Leaflet.draw with Leaflet.markercluster there
    // is a chance that a marker doesn't.
    if (!icon) {
      return;
    }

    // This is quite naughty, but I don't see another way of doing it. (short of setting a new icon)
    icon.style.display = 'none';

    if (L.DomUtil.hasClass(icon, 'leaflet-edit-marker-selected')) {
      L.DomUtil.removeClass(icon, 'leaflet-edit-marker-selected');
      // Offset as the border will make the icon move.
      this._offsetMarker(icon, -4);

    } else {
      L.DomUtil.addClass(icon, 'leaflet-edit-marker-selected');
      // Offset as the border will make the icon move.
      this._offsetMarker(icon, 4);
    }

    icon.style.display = '';
  },

  _offsetMarker: function (icon, offset) {
    var iconMarginTop = parseInt(icon.style.marginTop, 10) - offset,
        iconMarginLeft = parseInt(icon.style.marginLeft, 10) - offset;

    icon.style.marginTop = iconMarginTop + 'px';
    icon.style.marginLeft = iconMarginLeft + 'px';
  }
});

L.Marker.addInitHook(function () {
  if (L.Edit.Marker) {
    this.editing = new L.Edit.Marker(this);

    if (this.options.editable) {
      this.editing.enable();
    }
  }
});


L.Map.mergeOptions({
  touchExtend: true
});

L.Map.TouchExtend = L.Handler.extend({

  initialize: function (map) {
    this._map = map;
    this._container = map._container;
    this._pane = map._panes.overlayPane;
  },

  addHooks: function () {
    L.DomEvent.on(this._container, 'touchstart', this._onTouchStart, this);
    L.DomEvent.on(this._container, 'touchend', this._onTouchEnd, this);
    L.DomEvent.on(this._container, 'touchmove', this._onTouchMove, this);
    if (this._detectIE()) {
      L.DomEvent.on(this._container, 'MSPointerDown', this._onTouchStart, this);
      L.DomEvent.on(this._container, 'MSPointerUp', this._onTouchEnd, this);
      L.DomEvent.on(this._container, 'MSPointerMove', this._onTouchMove, this);
      L.DomEvent.on(this._container, 'MSPointerCancel', this._onTouchCancel, this);

    } else {
      L.DomEvent.on(this._container, 'touchcancel', this._onTouchCancel, this);
      L.DomEvent.on(this._container, 'touchleave', this._onTouchLeave, this);
    }
  },

  removeHooks: function () {
    L.DomEvent.off(this._container, 'touchstart', this._onTouchStart);
    L.DomEvent.off(this._container, 'touchend', this._onTouchEnd);
    L.DomEvent.off(this._container, 'touchmove', this._onTouchMove);
    if (this._detectIE()) {
      L.DomEvent.off(this._container, 'MSPointerDowm', this._onTouchStart);
      L.DomEvent.off(this._container, 'MSPointerUp', this._onTouchEnd);
      L.DomEvent.off(this._container, 'MSPointerMove', this._onTouchMove);
      L.DomEvent.off(this._container, 'MSPointerCancel', this._onTouchCancel);
    } else {
      L.DomEvent.off(this._container, 'touchcancel', this._onTouchCancel);
      L.DomEvent.off(this._container, 'touchleave', this._onTouchLeave);
    }
  },

  _touchEvent: function (e, type) {
    // #TODO: fix the pageX error that is do a bug in Android where a single touch triggers two click events
    // _filterClick is what leaflet uses as a workaround.
    // This is a problem with more things than just android. Another problem is touchEnd has no touches in
    // its touch list.
    var touchEvent = {};
    if (typeof e.touches !== 'undefined') {
      if (!e.touches.length) {
        return;
      }
      touchEvent = e.touches[0];
    } else if (e.pointerType === 'touch') {
      touchEvent = e;
      if (!this._filterClick(e)) {
        return;
      }
    } else {
      return;
    }

    var containerPoint = this._map.mouseEventToContainerPoint(touchEvent),
        layerPoint = this._map.mouseEventToLayerPoint(touchEvent),
        latlng = this._map.layerPointToLatLng(layerPoint);

    this._map.fire(type, {
      latlng: latlng,
      layerPoint: layerPoint,
      containerPoint: containerPoint,
      pageX: touchEvent.pageX,
      pageY: touchEvent.pageY,
      originalEvent: e
    });
  },

  /** Borrowed from Leaflet and modified for bool ops **/
  _filterClick: function (e) {
    var timeStamp = (e.timeStamp || e.originalEvent.timeStamp),
        elapsed = L.DomEvent._lastClick && (timeStamp - L.DomEvent._lastClick);

    // are they closer together than 500ms yet more than 100ms?
    // Android typically triggers them ~300ms apart while multiple listeners
    // on the same event should be triggered far faster;
    // or check if click is simulated on the element, and if it is, reject any non-simulated events
    if ((elapsed && elapsed > 100 && elapsed < 500) || (e.target._simulatedClick && !e._simulated)) {
      L.DomEvent.stop(e);
      return false;
    }
    L.DomEvent._lastClick = timeStamp;
    return true;
  },

  _onTouchStart: function (e) {
    if (!this._map._loaded) {
      return;
    }

    var type = 'touchstart';
    this._touchEvent(e, type);

  },

  _onTouchEnd: function (e) {
    if (!this._map._loaded) {
      return;
    }

    var type = 'touchend';
    this._touchEvent(e, type);
  },

  _onTouchCancel: function (e) {
    if (!this._map._loaded) {
      return;
    }

    var type = 'touchcancel';
    if (this._detectIE()) {
      type = 'pointercancel';
    }
    this._touchEvent(e, type);
  },

  _onTouchLeave: function (e) {
    if (!this._map._loaded) {
      return;
    }

    var type = 'touchleave';
    this._touchEvent(e, type);
  },

  _onTouchMove: function (e) {
    if (!this._map._loaded) {
      return;
    }

    var type = 'touchmove';
    this._touchEvent(e, type);
  },

  _detectIE: function () {
    var ua = window.navigator.userAgent;

    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
      // IE 10 or older => return version number
      return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    }

    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
      // IE 11 => return version number
      var rv = ua.indexOf('rv:');
      return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
    }

    var edge = ua.indexOf('Edge/');
    if (edge > 0) {
      // IE 12 => return version number
      return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
    }

    // other browser
    return false;
  }
});

L.Map.addInitHook('addHandler', 'touchExtend', L.Map.TouchExtend);

// This isn't full Touch support. This is just to get makers to also support dom touch events after creation
// #TODO: find a better way of getting markers to support touch.
L.Marker.Touch = L.Marker.extend({

  // This is an exact copy of https://github.com/Leaflet/Leaflet/blob/v0.7/src/layer/marker/Marker.js
  // with the addition of the touch event son line 15.
  _initInteraction: function () {

    if (!this.options.clickable) {
      return;
    }

    // TODO refactor into something shared with Map/Path/etc. to DRY it up

    var icon = this._icon,
        events = ['dblclick', 'mousedown', 'mouseover', 'mouseout', 'contextmenu', 'touchstart', 'touchend', 'touchmove'];
    if (this._detectIE) {
      events.concat(['MSPointerDown', 'MSPointerUp', 'MSPointerMove', 'MSPointerCancel']);
    } else {
      events.concat(['touchcancel']);
    }

    L.DomUtil.addClass(icon, 'leaflet-clickable');
    L.DomEvent.on(icon, 'click', this._onMouseClick, this);
    L.DomEvent.on(icon, 'keypress', this._onKeyPress, this);

    for (var i = 0; i < events.length; i++) {
      L.DomEvent.on(icon, events[i], this._fireMouseEvent, this);
    }

    if (L.Handler.MarkerDrag) {
      this.dragging = new L.Handler.MarkerDrag(this);

      if (this.options.draggable) {
        this.dragging.enable();
      }
    }
  },
  _detectIE: function () {
    var ua = window.navigator.userAgent;

    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
      // IE 10 or older => return version number
      return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    }

    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
      // IE 11 => return version number
      var rv = ua.indexOf('rv:');
      return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
    }

    var edge = ua.indexOf('Edge/');
    if (edge > 0) {
      // IE 12 => return version number
      return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
    }

    // other browser
    return false;
  }
});


/*
 * L.LatLngUtil contains different utility functions for LatLngs.
 */

L.LatLngUtil = {
  // Clones a LatLngs[], returns [][]
  cloneLatLngs: function (latlngs) {
    var clone = [];
    for (var i = 0, l = latlngs.length; i < l; i++) {
      clone.push(this.cloneLatLng(latlngs[i]));
    }
    return clone;
  },

  cloneLatLng: function (latlng) {
    return L.latLng(latlng.lat, latlng.lng);
  }
};

L.Control.Draw = L.Control.extend({

  options: {
    position: 'topleft',
    draw: {},
    edit: false
  },

  initialize: function (options) {
    if (L.version < '0.7') {
      throw new Error('Leaflet.draw 0.2.3+ requires Leaflet 0.7.0+. Download latest from https://github.com/Leaflet/Leaflet/');
    }

    L.Control.prototype.initialize.call(this, options);

    var toolbar;

    this._toolbars = {};

    // Initialize toolbars
    if (L.DrawToolbar && this.options.draw) {
      toolbar = new L.DrawToolbar(this.options.draw);

      this._toolbars[L.DrawToolbar.TYPE] = toolbar;

      // Listen for when toolbar is enabled
      this._toolbars[L.DrawToolbar.TYPE].on('enable', this._toolbarEnabled, this);
    }

    if (L.EditToolbar && this.options.edit) {
      toolbar = new L.EditToolbar(this.options.edit);

      this._toolbars[L.EditToolbar.TYPE] = toolbar;

      // Listen for when toolbar is enabled
      this._toolbars[L.EditToolbar.TYPE].on('enable', this._toolbarEnabled, this);
    }
    L.toolbar = this; //set global var for editing the toolbar
  },

  onAdd: function (map) {
    var container = L.DomUtil.create('div', 'leaflet-draw'),
        addedTopClass = false,
        topClassName = 'leaflet-draw-toolbar-top',
        toolbarContainer;

    for (var toolbarId in this._toolbars) {
      if (this._toolbars.hasOwnProperty(toolbarId)) {
        toolbarContainer = this._toolbars[toolbarId].addToolbar(map);

        if (toolbarContainer) {
          // Add class to the first toolbar to remove the margin
          if (!addedTopClass) {
            if (!L.DomUtil.hasClass(toolbarContainer, topClassName)) {
              L.DomUtil.addClass(toolbarContainer.childNodes[0], topClassName);
            }
            addedTopClass = true;
          }

          container.appendChild(toolbarContainer);
        }
      }
    }

    return container;
  },

  onRemove: function () {
    for (var toolbarId in this._toolbars) {
      if (this._toolbars.hasOwnProperty(toolbarId)) {
        this._toolbars[toolbarId].removeToolbar();
      }
    }
  },

  setDrawingOptions: function (options) {
    for (var toolbarId in this._toolbars) {
      if (this._toolbars[toolbarId] instanceof L.DrawToolbar) {
        this._toolbars[toolbarId].setOptions(options);
      }
    }
  },

  _toolbarEnabled: function (e) {
    var enabledToolbar = e.target;

    for (var toolbarId in this._toolbars) {
      if (this._toolbars[toolbarId] !== enabledToolbar) {
        this._toolbars[toolbarId].disable();
      }
    }
  }
});

L.Map.mergeOptions({
  drawControlTooltips: true,
  drawControl: false
});

L.Map.addInitHook(function () {
  if (this.options.drawControl) {
    this.drawControl = new L.Control.Draw();
    this.addControl(this.drawControl);
  }
});


L.Toolbar = L.Class.extend({
  includes: [L.Mixin.Events],

  initialize: function (options) {
    L.setOptions(this, options);

    this._modes = {};
    this._actionButtons = [];
    this._activeMode = null;
  },

  enabled: function () {
    return this._activeMode !== null;
  },

  disable: function () {
    if (!this.enabled()) {
      return;
    }

    this._activeMode.handler.disable();
  },

  addToolbar: function (map) {
    var container = L.DomUtil.create('div', 'leaflet-draw-section'),
        buttonIndex = 0,
        buttonClassPrefix = this._toolbarClass || '',
        modeHandlers = this.getModeHandlers(map),
        i;

    this._toolbarContainer = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar');
    this._map = map;

    for (i = 0; i < modeHandlers.length; i++) {
      if (modeHandlers[i].enabled) {
        this._initModeHandler(
            modeHandlers[i].handler,
            this._toolbarContainer,
            buttonIndex++,
            buttonClassPrefix,
            modeHandlers[i].title
        );
      }
    }

    // if no buttons were added, do not add the toolbar
    if (!buttonIndex) {
      return;
    }

    // Save button index of the last button, -1 as we would have ++ after the last button
    this._lastButtonIndex = --buttonIndex;

    // Create empty actions part of the toolbar
    this._actionsContainer = L.DomUtil.create('ul', 'leaflet-draw-actions');

    // Add draw and cancel containers to the control container
    container.appendChild(this._toolbarContainer);
    container.appendChild(this._actionsContainer);

    return container;
  },

  removeToolbar: function () {
    // Dispose each handler
    for (var handlerId in this._modes) {
      if (this._modes.hasOwnProperty(handlerId)) {
        // Unbind handler button
        this._disposeButton(
            this._modes[handlerId].button,
            this._modes[handlerId].handler.enable,
            this._modes[handlerId].handler
        );

        // Make sure is disabled
        this._modes[handlerId].handler.disable();

        // Unbind handler
        this._modes[handlerId].handler
            .off('enabled', this._handlerActivated, this)
            .off('disabled', this._handlerDeactivated, this);
      }
    }
    this._modes = {};

    // Dispose the actions toolbar
    for (var i = 0, l = this._actionButtons.length; i < l; i++) {
      this._disposeButton(
          this._actionButtons[i].button,
          this._actionButtons[i].callback,
          this
      );
    }
    this._actionButtons = [];
    this._actionsContainer = null;
  },

  _initModeHandler: function (handler, container, buttonIndex, classNamePredix, buttonTitle) {
    var type = handler.type;

    this._modes[type] = {};

    this._modes[type].handler = handler;

    this._modes[type].button = this._createButton({
      type: type,
      title: buttonTitle,
      className: classNamePredix + '-' + type,
      container: container,
      callback: this._modes[type].handler.enable,
      context: this._modes[type].handler
    });

    this._modes[type].buttonIndex = buttonIndex;

    this._modes[type].handler
        .on('enabled', this._handlerActivated, this)
        .on('disabled', this._handlerDeactivated, this);
  },

  _createButton: function (options) {

    var link = L.DomUtil.create('a', options.className || '', options.container);
    link.href = '#';

    if (options.text) {
      link.innerHTML = options.text;
    }

    if (options.title) {
      link.title = options.title;
    }

    L.DomEvent
        .on(link, 'click', L.DomEvent.stopPropagation)
        .on(link, 'mousedown', L.DomEvent.stopPropagation)
        .on(link, 'dblclick', L.DomEvent.stopPropagation)
        .on(link, 'click', L.DomEvent.preventDefault)
        .on(link, 'click', options.callback, options.context);

    return link;
  },

  _disposeButton: function (button, callback) {
    L.DomEvent
        .off(button, 'click', L.DomEvent.stopPropagation)
        .off(button, 'mousedown', L.DomEvent.stopPropagation)
        .off(button, 'dblclick', L.DomEvent.stopPropagation)
        .off(button, 'click', L.DomEvent.preventDefault)
        .off(button, 'click', callback);
  },

  _handlerActivated: function (e) {
    // Disable active mode (if present)
    this.disable();

    // Cache new active feature
    this._activeMode = this._modes[e.handler];

    L.DomUtil.addClass(this._activeMode.button, 'leaflet-draw-toolbar-button-enabled');

    this._showActionsToolbar();

    this.fire('enable');
  },

  _handlerDeactivated: function () {
    this._hideActionsToolbar();

    L.DomUtil.removeClass(this._activeMode.button, 'leaflet-draw-toolbar-button-enabled');

    this._activeMode = null;

    this.fire('disable');
  },

  _createActions: function (handler) {
    var container = this._actionsContainer,
        buttons = this.getActions(handler),
        l = buttons.length,
        li, di, dl, button;

    // Dispose the actions toolbar (todo: dispose only not used buttons)
    for (di = 0, dl = this._actionButtons.length; di < dl; di++) {
      this._disposeButton(this._actionButtons[di].button, this._actionButtons[di].callback);
    }
    this._actionButtons = [];

    // Remove all old buttons
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    for (var i = 0; i < l; i++) {
      if ('enabled' in buttons[i] && !buttons[i].enabled) {
        continue;
      }

      li = L.DomUtil.create('li', '', container);

      button = this._createButton({
        title: buttons[i].title,
        text: buttons[i].text,
        container: li,
        callback: buttons[i].callback,
        context: buttons[i].context
      });

      this._actionButtons.push({
        button: button,
        callback: buttons[i].callback
      });
    }
  },

  _showActionsToolbar: function () {
    var buttonIndex = this._activeMode.buttonIndex,
        lastButtonIndex = this._lastButtonIndex,
        toolbarPosition = this._activeMode.button.offsetTop - 1;

    // Recreate action buttons on every click
    this._createActions(this._activeMode.handler);

    // Correctly position the cancel button
    this._actionsContainer.style.top = toolbarPosition + 'px';

    if (buttonIndex === 0) {
      L.DomUtil.addClass(this._toolbarContainer, 'leaflet-draw-toolbar-notop');
      L.DomUtil.addClass(this._actionsContainer, 'leaflet-draw-actions-top');
    }

    if (buttonIndex === lastButtonIndex) {
      L.DomUtil.addClass(this._toolbarContainer, 'leaflet-draw-toolbar-nobottom');
      L.DomUtil.addClass(this._actionsContainer, 'leaflet-draw-actions-bottom');
    }

    this._actionsContainer.style.display = 'block';
  },

  _hideActionsToolbar: function () {
    this._actionsContainer.style.display = 'none';

    L.DomUtil.removeClass(this._toolbarContainer, 'leaflet-draw-toolbar-notop');
    L.DomUtil.removeClass(this._toolbarContainer, 'leaflet-draw-toolbar-nobottom');
    L.DomUtil.removeClass(this._actionsContainer, 'leaflet-draw-actions-top');
    L.DomUtil.removeClass(this._actionsContainer, 'leaflet-draw-actions-bottom');
  }
});


L.Toolbar.List = L.Toolbar.extend({

  addToolbar: function (map) {
    var container = L.DomUtil.create('div', 'leaflet-draw-section'),
        buttonIndex = 0,
        buttonClassPrefix = this._toolbarClass || '',
        modeHandlers = this.getModeHandlers(map),
        i;

    this._toolbarContainer = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar');
    this._map = map;

    for (i = 0; i < modeHandlers.length; i++) {
      if (modeHandlers[i].enabled) {
        this._initModeHandler(
            i,
            modeHandlers[i].handler,
            this._toolbarContainer,
            buttonIndex++,
            buttonClassPrefix,
            modeHandlers[i].title,
            modeHandlers[i].label
        );
      }
    }

    // if no buttons were added, do not add the toolbar
    if (!buttonIndex) {
      return;
    }

    // Save button index of the last button, -1 as we would have ++ after the last button
    this._lastButtonIndex = --buttonIndex;

    // Create empty actions part of the toolbar
    this._actionsContainer = L.DomUtil.create('ul', 'leaflet-draw-actions');

    // Add draw and cancel containers to the control container
    container.appendChild(this._toolbarContainer);
    container.appendChild(this._actionsContainer);

    //when markers are deleted
    this._map.on('draw:deleted', this._showButton, this);

    return container;
  },
  
  _initModeHandler: function (id, handler, container, buttonIndex, classNamePredix, buttonTitle, buttonLabel) {

    var type = handler.type;

    var text = buttonLabel || '';

    this._modes[id] = {};

    this._modes[id].handler = handler;
    this._modes[id].handler.buttonId = id;

    this._modes[id].button = this._createButton({
      type: type,
      title: buttonTitle,
      className: classNamePredix + '-' + type,
      container: container,
      callback: this._modes[id].handler.enable,
      context: this._modes[id].handler,
      text: text
    });

    this._modes[id].buttonIndex = buttonIndex;

    this._modes[id].handler
        .on('enabled', this._handlerActivated, this)
        .on('disabled', this._handlerDeactivated, this)
        .on('draw:hideButton', this._hideButton, this)
        .on('draw:showButton', this._showButton, this);
  },

  _createButton: function(options){
    var link = L.DomUtil.create('a', options.className || '', options.container);
    link.href = '#';

    if (options.text) {
      link.innerHTML = options.text;
    }

    if (options.title) {
      link.title = options.title;
    }

    L.DomEvent
        .on(link, 'click', L.DomEvent.stopPropagation)
        .on(link, 'mousedown', L.DomEvent.stopPropagation)
        .on(link, 'dblclick', L.DomEvent.stopPropagation)
        .on(link, 'click', L.DomEvent.preventDefault)
        .on(link, 'click', options.callback, options.context);

    return link;
  },

  _handlerActivated: function (e) {

    var index = e.target.buttonId;

    // Disable active mode (if present)
    this.disable();

    // Cache new active feature
    this._activeMode = this._modes[index];

    L.DomUtil.addClass(this._activeMode.button, 'leaflet-draw-toolbar-button-enabled');

    this._showActionsToolbar();

    this.fire('enable');
  },

  _showActionsToolbar: function () {
    var buttonIndex = this._activeMode.buttonIndex,
        lastButtonIndex = this._lastButtonIndex,
        toolbarTopPosition = this._activeMode.button.offsetTop - 1,
        toolbarLeftPostition = this._activeMode.button.clientWidth;

    // Recreate action buttons on every click
    this._createActions(this._activeMode.handler);

    // Correctly position the cancel button
    this._actionsContainer.style.top = toolbarTopPosition + 'px';
    this._actionsContainer.style.left = toolbarLeftPostition + 'px';

    if (buttonIndex === 0) {
      L.DomUtil.addClass(this._toolbarContainer, 'leaflet-draw-toolbar-notop');
      L.DomUtil.addClass(this._actionsContainer, 'leaflet-draw-actions-top');
    }

    if (buttonIndex === lastButtonIndex) {
      L.DomUtil.addClass(this._toolbarContainer, 'leaflet-draw-toolbar-nobottom');
      L.DomUtil.addClass(this._actionsContainer, 'leaflet-draw-actions-bottom');
    }

    this._actionsContainer.style.display = 'block';
  },

  _hideButton: function(e){
    if(typeof this._modes[e.buttonId] !== 'undefined'){
      this._modes[e.buttonId].button.style.display = 'none';
    }
  },

  _showButton: function(e){
    var layers = e.layers;

    layers.eachLayer(function(layer){
      if(typeof layer.options.buttonId !== 'undefined' && typeof this._modes[layer.options.buttonId] !== 'undefined'){
        this._modes[layer.options.buttonId].button.style.display = 'block';
      }
    }, this);

  }
  
});

L.Tooltip = L.Class.extend({
  initialize: function (map) {
    this._map = map;
    this._popupPane = map._panes.popupPane;

    this._container = map.options.drawControlTooltips ? L.DomUtil.create('div', 'leaflet-draw-tooltip', this._popupPane) : null;
    this._singleLineLabel = false;

    this._map.on('mouseout', this._onMouseOut, this);
  },

  dispose: function () {
    this._map.off('mouseout', this._onMouseOut, this);

    if (this._container) {
      this._popupPane.removeChild(this._container);
      this._container = null;
    }
  },

  updateContent: function (labelText) {
    if (!this._container) {
      return this;
    }
    labelText.subtext = labelText.subtext || '';

    // update the vertical position (only if changed)
    if (labelText.subtext.length === 0 && !this._singleLineLabel) {
      L.DomUtil.addClass(this._container, 'leaflet-draw-tooltip-single');
      this._singleLineLabel = true;
    }
    else if (labelText.subtext.length > 0 && this._singleLineLabel) {
      L.DomUtil.removeClass(this._container, 'leaflet-draw-tooltip-single');
      this._singleLineLabel = false;
    }

    this._container.innerHTML =
        (labelText.subtext.length > 0 ? '<span class="leaflet-draw-tooltip-subtext">' + labelText.subtext + '</span>' + '<br />' : '') +
        '<span>' + labelText.text + '</span>';

    return this;
  },

  updatePosition: function (latlng) {
    var pos = this._map.latLngToLayerPoint(latlng),
        tooltipContainer = this._container;

    if (this._container) {
      tooltipContainer.style.visibility = 'inherit';
      L.DomUtil.setPosition(tooltipContainer, pos);
    }

    return this;
  },

  showAsError: function () {
    if (this._container) {
      L.DomUtil.addClass(this._container, 'leaflet-error-draw-tooltip');
    }
    return this;
  },

  removeError: function () {
    if (this._container) {
      L.DomUtil.removeClass(this._container, 'leaflet-error-draw-tooltip');
    }
    return this;
  },

  _onMouseOut: function () {
    if (this._container) {
      this._container.style.visibility = 'hidden';
    }
  }
});


L.DrawToolbar = L.Toolbar.List.extend({

  statics: {
    TYPE: 'draw'
  },

  options: {
    polyline: {},
    polygon: {},
    rectangle: {},
    circle: {},
    marker: {}
  },

  initialize: function (options) {
    // Ensure that the options are merged correctly since L.extend is only shallow
    for (var type in this.options) {
      if (this.options.hasOwnProperty(type)) {
        if (options[type]) {
          options[type] = L.extend({}, this.options[type], options[type]);
        }
      }
    }

    this._toolbarClass = 'leaflet-draw-draw';
    L.Toolbar.prototype.initialize.call(this, options);
  },

  getModeHandlers: function (map) {

    //fetched with a $http.GET
    var resources = [
      {label: 'Resource 1'},
      {label: 'Resource 2'},
      {label: 'Resource 3'},
      {label: 'Resource 4'}
    ];

    var modeHandlers = [];

    for(var i = 0; i < resources.length; i++){
      var modeHandler = {
        enabled: this.options.marker,
        handler: new L.Draw.Marker(map, this.options.marker),
        title: L.drawLocal.draw.toolbar.buttons.marker,
        label: resources[i].label
      };

      modeHandlers.push(modeHandler);
    }

    return modeHandlers;
  },

  // Get the actions part of the toolbar
  getActions: function (handler) {
    return [
      {
        enabled: handler.completeShape,
        title: L.drawLocal.draw.toolbar.finish.title,
        text: L.drawLocal.draw.toolbar.finish.text,
        callback: handler.completeShape,
        context: handler
      },
      {
        enabled: handler.deleteLastVertex,
        title: L.drawLocal.draw.toolbar.undo.title,
        text: L.drawLocal.draw.toolbar.undo.text,
        callback: handler.deleteLastVertex,
        context: handler
      },
      {
        title: L.drawLocal.draw.toolbar.actions.title,
        text: L.drawLocal.draw.toolbar.actions.text,
        callback: this.disable,
        context: this
      }
    ];
  },

  setOptions: function (options) {
    L.setOptions(this, options);

    for (var type in this._modes) {
      if (this._modes.hasOwnProperty(type) && options.hasOwnProperty(type)) {
        this._modes[type].handler.setOptions(options[type]);
      }
    }
  }
});


/*L.Map.mergeOptions({
 editControl: true
 });*/

L.EditToolbar = L.Toolbar.extend({
  statics: {
    TYPE: 'edit'
  },

  options: {
    edit: {
      selectedPathOptions: {
        dashArray: '10, 10',

        fill: true,
        fillColor: '#fe57a1',
        fillOpacity: 0.1,

        // Whether to user the existing layers color
        maintainColor: false
      }
    },
    remove: {},
    poly: null,
    featureGroup: null /* REQUIRED! TODO: perhaps if not set then all layers on the map are selectable? */
  },

  initialize: function (options) {
    // Need to set this manually since null is an acceptable value here
    if (options.edit) {
      if (typeof options.edit.selectedPathOptions === 'undefined') {
        options.edit.selectedPathOptions = this.options.edit.selectedPathOptions;
      }
      options.edit.selectedPathOptions = L.extend({}, this.options.edit.selectedPathOptions, options.edit.selectedPathOptions);
    }

    if (options.remove) {
      options.remove = L.extend({}, this.options.remove, options.remove);
    }

    if (options.poly) {
      options.poly = L.extend({}, this.options.poly, options.poly);
    }

    this._toolbarClass = 'leaflet-draw-edit';
    L.Toolbar.prototype.initialize.call(this, options);

    this._selectedFeatureCount = 0;
  },

  getModeHandlers: function (map) {
    var featureGroup = this.options.featureGroup;
    return [
      {
        enabled: this.options.edit,
        handler: new L.EditToolbar.Edit(map, {
          featureGroup: featureGroup,
          selectedPathOptions: this.options.edit.selectedPathOptions,
          poly: this.options.poly
        }),
        title: L.drawLocal.edit.toolbar.buttons.edit
      },
      {
        enabled: this.options.remove,
        handler: new L.EditToolbar.Delete(map, {
          featureGroup: featureGroup
        }),
        title: L.drawLocal.edit.toolbar.buttons.remove
      }
    ];
  },

  getActions: function () {
    return [
      {
        title: L.drawLocal.edit.toolbar.actions.save.title,
        text: L.drawLocal.edit.toolbar.actions.save.text,
        callback: this._save,
        context: this
      },
      {
        title: L.drawLocal.edit.toolbar.actions.cancel.title,
        text: L.drawLocal.edit.toolbar.actions.cancel.text,
        callback: this.disable,
        context: this
      }
    ];
  },

  addToolbar: function (map) {
    var container = L.Toolbar.prototype.addToolbar.call(this, map);

    this._checkDisabled();

    this.options.featureGroup.on('layeradd layerremove', this._checkDisabled, this);

    return container;
  },

  removeToolbar: function () {
    this.options.featureGroup.off('layeradd layerremove', this._checkDisabled, this);

    L.Toolbar.prototype.removeToolbar.call(this);
  },

  disable: function () {
    if (!this.enabled()) {
      return;
    }

    this._activeMode.handler.revertLayers();

    L.Toolbar.prototype.disable.call(this);
  },

  _save: function () {
    this._activeMode.handler.save();
    this._activeMode.handler.disable();
  },

  _checkDisabled: function () {
    var featureGroup = this.options.featureGroup,
        hasLayers = featureGroup.getLayers().length !== 0,
        button;

    if (this.options.edit) {
      button = this._modes[L.EditToolbar.Edit.TYPE].button;

      if (hasLayers) {
        L.DomUtil.removeClass(button, 'leaflet-disabled');
      } else {
        L.DomUtil.addClass(button, 'leaflet-disabled');
      }

      button.setAttribute(
          'title',
          hasLayers ?
              L.drawLocal.edit.toolbar.buttons.edit
              : L.drawLocal.edit.toolbar.buttons.editDisabled
      );
    }

    if (this.options.remove) {
      button = this._modes[L.EditToolbar.Delete.TYPE].button;

      if (hasLayers) {
        L.DomUtil.removeClass(button, 'leaflet-disabled');
      } else {
        L.DomUtil.addClass(button, 'leaflet-disabled');
      }

      button.setAttribute(
          'title',
          hasLayers ?
              L.drawLocal.edit.toolbar.buttons.remove
              : L.drawLocal.edit.toolbar.buttons.removeDisabled
      );
    }
  }
});


L.EditToolbar.Edit = L.Handler.extend({
  statics: {
    TYPE: 'edit'
  },

  includes: L.Mixin.Events,

  initialize: function (map, options) {
    L.Handler.prototype.initialize.call(this, map);

    L.setOptions(this, options);

    // Store the selectable layer group for ease of access
    this._featureGroup = options.featureGroup;

    if (!(this._featureGroup instanceof L.FeatureGroup)) {
      throw new Error('options.featureGroup must be a L.FeatureGroup');
    }

    this._uneditedLayerProps = {};

    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
    this.type = L.EditToolbar.Edit.TYPE;
  },

  enable: function () {
    if (this._enabled || !this._hasAvailableLayers()) {
      return;
    }
    this.fire('enabled', {handler: this.type});
    //this disable other handlers

    this._map.fire('draw:editstart', {handler: this.type});
    //allow drawLayer to be updated before beginning edition.

    L.Handler.prototype.enable.call(this);
    this._featureGroup
        .on('layeradd', this._enableLayerEdit, this)
        .on('layerremove', this._disableLayerEdit, this);
  },

  disable: function () {
    if (!this._enabled) {
      return;
    }
    this._featureGroup
        .off('layeradd', this._enableLayerEdit, this)
        .off('layerremove', this._disableLayerEdit, this);
    L.Handler.prototype.disable.call(this);
    this._map.fire('draw:editstop', {handler: this.type});
    this.fire('disabled', {handler: this.type});
  },

  addHooks: function () {
    var map = this._map;

    if (map) {
      map.getContainer().focus();

      this._featureGroup.eachLayer(this._enableLayerEdit, this);

      this._tooltip = new L.Tooltip(this._map);
      this._tooltip.updateContent({
        text: L.drawLocal.edit.handlers.edit.tooltip.text,
        subtext: L.drawLocal.edit.handlers.edit.tooltip.subtext
      });

      // Quickly access the tooltip to update for intersection checking
      map._editTooltip = this._tooltip;

      this._updateTooltip();

      this._map
          .on('mousemove', this._onMouseMove, this)
          .on('touchmove', this._onMouseMove, this)
          .on('MSPointerMove', this._onMouseMove, this)
          .on('click', this._editStyle, this)
          .on('draw:editvertex', this._updateTooltip, this);
    }
  },

  removeHooks: function () {
    if (this._map) {
      // Clean up selected layers.
      this._featureGroup.eachLayer(this._disableLayerEdit, this);

      // Clear the backups of the original layers
      this._uneditedLayerProps = {};

      this._tooltip.dispose();
      this._tooltip = null;

      this._map
          .off('mousemove', this._onMouseMove, this)
          .off('touchmove', this._onMouseMove, this)
          .off('MSPointerMove', this._onMouseMove, this)
          .off('click', this._editStyle, this)
          .off('draw:editvertex', this._updateTooltip, this);
    }
  },

  revertLayers: function () {
    this._featureGroup.eachLayer(function (layer) {
      this._revertLayer(layer);
    }, this);
  },

  save: function () {
    var editedLayers = new L.LayerGroup();
    this._featureGroup.eachLayer(function (layer) {
      if (layer.edited) {
        editedLayers.addLayer(layer);
        layer.edited = false;
      }
    });
    this._map.fire('draw:edited', {layers: editedLayers});
  },

  _backupLayer: function (layer) {
    var id = L.Util.stamp(layer);

    if (!this._uneditedLayerProps[id]) {
      // Polyline, Polygon or Rectangle
      if (layer instanceof L.Polyline || layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        this._uneditedLayerProps[id] = {
          latlngs: L.LatLngUtil.cloneLatLngs(layer.getLatLngs())
        };
      } else if (layer instanceof L.Circle) {
        this._uneditedLayerProps[id] = {
          latlng: L.LatLngUtil.cloneLatLng(layer.getLatLng()),
          radius: layer.getRadius()
        };
      } else if (layer instanceof L.Marker) { // Marker
        this._uneditedLayerProps[id] = {
          latlng: L.LatLngUtil.cloneLatLng(layer.getLatLng())
        };
      }
    }
  },

  _getTooltipText: function () {
    return ({
      text: L.drawLocal.edit.handlers.edit.tooltip.text,
      subtext: L.drawLocal.edit.handlers.edit.tooltip.subtext
    });
  },

  _updateTooltip: function () {
    this._tooltip.updateContent(this._getTooltipText());
  },

  _revertLayer: function (layer) {
    var id = L.Util.stamp(layer);
    layer.edited = false;
    if (this._uneditedLayerProps.hasOwnProperty(id)) {
      // Polyline, Polygon or Rectangle
      if (layer instanceof L.Polyline || layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        layer.setLatLngs(this._uneditedLayerProps[id].latlngs);
      } else if (layer instanceof L.Circle) {
        layer.setLatLng(this._uneditedLayerProps[id].latlng);
        layer.setRadius(this._uneditedLayerProps[id].radius);
      } else if (layer instanceof L.Marker) { // Marker
        layer.setLatLng(this._uneditedLayerProps[id].latlng);
      }

      layer.fire('revert-edited', {layer: layer});
    }
  },

  _enableLayerEdit: function (e) {
    var layer = e.layer || e.target || e,
        pathOptions, poly;

    // Back up this layer (if haven't before)
    this._backupLayer(layer);

    if (this.options.poly) {
      poly = L.Util.extend({}, this.options.poly);
      layer.options.poly = poly;
    }

    // Set different style for editing mode
    if (this.options.selectedPathOptions) {
      pathOptions = L.Util.extend({}, this.options.selectedPathOptions);

      // Use the existing color of the layer
      if (pathOptions.maintainColor) {
        pathOptions.color = layer.options.color;
        pathOptions.fillColor = layer.options.fillColor;
      }

      layer.options.original = L.extend({}, layer.options);
      layer.options.editing = pathOptions;

    }

    if (this.isMarker) {
      layer.dragging.enable();
      layer
          .on('dragend', this._onMarkerDragEnd)
          // #TODO: remove when leaflet finally fixes their draggable so it's touch friendly again.
          .on('touchmove', this._onTouchMove, this)
          .on('MSPointerMove', this._onTouchMove, this)
          .on('touchend', this._onMarkerDragEnd, this)
          .on('MSPointerUp', this._onMarkerDragEnd, this);
    } else {
      layer.editing.enable();
    }
  },

  _disableLayerEdit: function (e) {
    var layer = e.layer || e.target || e;

    layer.edited = false;
    layer.editing.disable();

    delete layer.options.editing;
    delete layer.options.original;
    // Reset layer styles to that of before select
    if (this._selectedPathOptions) {
      if (layer instanceof L.Marker) {
        this._toggleMarkerHighlight(layer);
      } else {
        // reset the layer style to what is was before being selected
        layer.setStyle(layer.options.previousOptions);
        // remove the cached options for the layer object
        delete layer.options.previousOptions;
      }
    }

    if (layer instanceof L.Marker) {
      layer.dragging.disable();
      layer
          .off('dragend', this._onMarkerDragEnd, this)
          .off('touchmove', this._onTouchMove, this)
          .off('MSPointerMove', this._onTouchMove, this)
          .off('touchend', this._onMarkerDragEnd, this)
          .off('MSPointerUp', this._onMarkerDragEnd, this);
    } else {
      layer.editing.disable();
    }
  },

  _onMouseMove: function (e) {
    this._tooltip.updatePosition(e.latlng);
  },

  _onTouchMove: function (e) {
    var touchEvent = e.originalEvent.changedTouches[0],
        layerPoint = this._map.mouseEventToLayerPoint(touchEvent),
        latlng = this._map.layerPointToLatLng(layerPoint);
    e.target.setLatLng(latlng);
  },

  _hasAvailableLayers: function () {
    return this._featureGroup.getLayers().length !== 0;
  }
});


L.EditToolbar.Delete = L.Handler.extend({
  statics: {
    TYPE: 'remove' // not delete as delete is reserved in js
  },

  includes: L.Mixin.Events,

  initialize: function (map, options) {
    L.Handler.prototype.initialize.call(this, map);

    L.Util.setOptions(this, options);

    // Store the selectable layer group for ease of access
    this._deletableLayers = this.options.featureGroup;

    if (!(this._deletableLayers instanceof L.FeatureGroup)) {
      throw new Error('options.featureGroup must be a L.FeatureGroup');
    }

    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
    this.type = L.EditToolbar.Delete.TYPE;
  },

  enable: function () {
    if (this._enabled || !this._hasAvailableLayers()) {
      return;
    }
    this.fire('enabled', {handler: this.type});

    this._map.fire('draw:deletestart', {handler: this.type});

    L.Handler.prototype.enable.call(this);

    this._deletableLayers
        .on('layeradd', this._enableLayerDelete, this)
        .on('layerremove', this._disableLayerDelete, this);
  },

  disable: function () {
    if (!this._enabled) {
      return;
    }

    this._deletableLayers
        .off('layeradd', this._enableLayerDelete, this)
        .off('layerremove', this._disableLayerDelete, this);

    L.Handler.prototype.disable.call(this);

    this._map.fire('draw:deletestop', {handler: this.type});

    this.fire('disabled', {handler: this.type});
  },

  addHooks: function () {
    var map = this._map;

    if (map) {
      map.getContainer().focus();

      this._deletableLayers.eachLayer(this._enableLayerDelete, this);
      this._deletedLayers = new L.LayerGroup();

      this._tooltip = new L.Tooltip(this._map);
      this._tooltip.updateContent({text: L.drawLocal.edit.handlers.remove.tooltip.text});

      this._map.on('mousemove', this._onMouseMove, this);
    }
  },

  removeHooks: function () {
    if (this._map) {
      this._deletableLayers.eachLayer(this._disableLayerDelete, this);
      this._deletedLayers = null;

      this._tooltip.dispose();
      this._tooltip = null;

      this._map.off('mousemove', this._onMouseMove, this);
    }
  },

  revertLayers: function () {
    // Iterate of the deleted layers and add them back into the featureGroup
    this._deletedLayers.eachLayer(function (layer) {
      this._deletableLayers.addLayer(layer);
      layer.fire('revert-deleted', {layer: layer});
    }, this);
  },

  save: function () {
    this._map.fire('draw:deleted', {layers: this._deletedLayers});
  },

  _enableLayerDelete: function (e) {
    var layer = e.layer || e.target || e;

    layer.on('click', this._removeLayer, this);
  },

  _disableLayerDelete: function (e) {
    var layer = e.layer || e.target || e;

    layer.off('click', this._removeLayer, this);

    // Remove from the deleted layers so we can't accidentally revert if the user presses cancel
    this._deletedLayers.removeLayer(layer);
  },

  _removeLayer: function (e) {
    var layer = e.layer || e.target || e;

    this._deletableLayers.removeLayer(layer);

    this._deletedLayers.addLayer(layer);

    layer.fire('deleted');
  },

  _onMouseMove: function (e) {
    this._tooltip.updatePosition(e.latlng);
  },

  _hasAvailableLayers: function () {
    return this._deletableLayers.getLayers().length !== 0;
  }
});


}(window, document));