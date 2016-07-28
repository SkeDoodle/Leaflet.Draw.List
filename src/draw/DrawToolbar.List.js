L.DrawToolbar.List = L.Toolbar.List.extend({

  statics: {
    TYPE: 'draw'
  },

  options: {
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
    L.Toolbar.List.prototype.initialize.call(this, options);
  },

  getModeHandlers: function (map, resources) {

    //TODO fetch resources with a $http.GET
    // resources = resources || [];

    resources = [
      {'label': 'Resource 1'},
      {'label': 'Resource 2'},
      {'label': 'Resource 3'},
      {'label': 'Resource 4'}
    ];

    var modeHandlers = [];

    for(var i = 0; i < resources.length; i++){
      var modeHandler = {
        enabled: this.options.marker,
        handler: new L.Draw.Marker.List(map, this.options.marker),
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
  }
});
