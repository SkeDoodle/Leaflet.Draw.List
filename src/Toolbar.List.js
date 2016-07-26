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