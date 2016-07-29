L.Toolbar.List = L.Toolbar.extend({

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
    if (!this.enabled()) { return; }

    this._activeMode.handler.disable();
  },

  addToolbar: function (map) {
    var container = L.DomUtil.create('div', 'leaflet-draw-section'),
        buttonIndex = 0,
        buttonClassPrefix = this._toolbarClass || '',
        i;

    var modeHandlers = this.getModeHandlers(map);

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
        .on('disabled', this._handlerDeactivated, this);

    if(type === L.Draw.Marker.List.TYPE){
      this._modes[id].handler
          .on('draw:hideButton', this._hideButton, this)
          .on('draw:showButton', this._showButton, this);
    }
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

  _disposeButton: function (button, callback) {
    L.DomEvent
        .off(button, 'click', L.DomEvent.stopPropagation)
        .off(button, 'mousedown', L.DomEvent.stopPropagation)
        .off(button, 'dblclick', L.DomEvent.stopPropagation)
        .off(button, 'click', L.DomEvent.preventDefault)
        .off(button, 'click', callback);
  },

  _handlerActivated: function (e) {

    var index = e.target.buttonId;

    // Disable active mode (if present)
    this.disable();

    // Cache new active feature
    this._activeMode = this._modes[e.target.buttonId];

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
        toolbarTopPosition = this._activeMode.button.offsetTop - 1,
        toolbarWidthPosition = this._activeMode.button.offsetWidth;

    // Recreate action buttons on every click
    this._createActions(this._activeMode.handler);

    // Correctly position the cancel button
    this._actionsContainer.style.top = toolbarTopPosition + 'px';
    this._actionsContainer.style.left = toolbarWidthPosition + 'px';

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