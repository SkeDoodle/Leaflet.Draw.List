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

  _initModeHandler: function (id, handler, container, buttonIndex, classNamePredix, buttonTitle) {

    var type = handler.type;

    this._modes[id] = {};

    this._modes[id].handler = handler;
    this._modes[id].handler.id = id;

    this._modes[id].button = this._createButton({
      type: type,
      title: buttonTitle,
      className: classNamePredix + '-' + type,
      container: container,
      callback: this._modes[id].handler.enable,
      context: this._modes[id].handler
    });

    this._modes[id].buttonIndex = buttonIndex;

    this._modes[id].handler
        .on('enabled', this._handlerActivated, this)
        .on('disabled', this._handlerDeactivated, this);
  },

  _handlerActivated: function (e) {

    var index = e.target.id;

    // Disable active mode (if present)
    this.disable();

    // Cache new active feature
    this._activeMode = this._modes[index];

    L.DomUtil.addClass(this._activeMode.button, 'leaflet-draw-toolbar-button-enabled');

    this._showActionsToolbar();

    this.fire('enable');
  }
});