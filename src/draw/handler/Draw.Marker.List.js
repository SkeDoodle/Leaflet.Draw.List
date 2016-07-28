L.Draw.Marker.List = L.Draw.Marker.extend({
  statics: {
    TYPE: 'marker-list'
  },

  options: {
    icon: new L.Icon.Default(),
    repeatMode: false,
    zIndexOffset: 2000 // This should be > than the highest z-index any markers
  },

  initialize: function (map, options) {
    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
    this.type = L.Draw.Marker.List.TYPE;

    L.Draw.Feature.prototype.initialize.call(this, map, options);
  },

  _fireCreatedEvent: function () {
    var marker = new L.Marker.Touch(this._marker.getLatLng(), {icon: this.options.icon, buttonId: this.buttonId});
   this.fire('draw:hideButton', {buttonId: this.buttonId});
    L.Draw.Feature.prototype._fireCreatedEvent.call(this, marker);
  }
});
