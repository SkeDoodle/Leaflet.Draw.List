L.Control.Draw.List = L.Control.Draw.extend({

  options: {
    position: 'topleft',
    list: [],
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
    if (L.DrawToolbar.List && Array.isArray(this.options.list)) {
      toolbar = new L.DrawToolbar.List(this.options.list);

      this._toolbars[L.DrawToolbar.List.TYPE] = toolbar;

      // Listen for when toolbar is enabled
      this._toolbars[L.DrawToolbar.List.TYPE].on('enable', this._toolbarEnabled, this);
    }

    if (L.EditToolbar && this.options.edit) {
      toolbar = new L.EditToolbar(this.options.edit);

      this._toolbars[L.EditToolbar.TYPE] = toolbar;

      // Listen for when toolbar is enabled
      this._toolbars[L.EditToolbar.TYPE].on('enable', this._toolbarEnabled, this);
    }
    L.toolbar = this; //set global var for editing the toolbar
  },

  setToolbarButtons: function(resources){
    var i;

    var modeHandlers = this._toolbars.draw.getModeHandlers(this._map);
    
    for(i = 0; i < modeHandlers.length; i++){
        this._toolbars.draw.addToolbar(this._map, modeHandlers);
    }
  }
});

L.Map.mergeOptions({
  drawControlTooltips: true,
  drawControl: false
});

L.Map.addInitHook(function () {
  if (this.options.drawControl) {
    this.drawControl = new L.Control.Draw.List();
    this.addControl(this.drawControl);
  }
});
