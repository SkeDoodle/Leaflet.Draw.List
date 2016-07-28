var deps = {
	Core: {
		src: [
			'Leaflet.draw.js'
		],
		desc: 'The core of the plugin. Currently only includes the version.'
	},

	DrawHandlers: {
		src: [
			'draw/handler/Draw.Feature.js',
			'draw/handler/Draw.Marker.js'
		],
		desc: 'Drawing handlers for: polylines, polygons, rectangles, circles and markers.',
		deps: ['Core']
	},

	EditHandlers: {
		src: [
			'edit/handler/Edit.Marker.js'
		],
		desc: 'Editing handlers for: polylines, polygons, rectangles, and circles.',
		deps: ['Core']
	},

	Extensions: {
		src: [
			'ext/TouchEvents.js',
			'ext/LatLngUtil.js'
		],
		desc: 'Extensions of leaflet classes.'
	},

	CommonUI: {
		src: [
			'Control.Draw.js',
			'Toolbar.js',
			'Toolbar.List.js',
			'Tooltip.js'
		],
		desc: 'Common UI components used.',
		deps: ['Extensions']
	},

	DrawUI: {
		src: [
			'draw/DrawToolbar.js'
		],
		desc: 'Draw toolbar.',
		deps: ['DrawHandlers', 'CommonUI']
	},

	EditUI: {
		src: [
			'edit/EditToolbar.js',
			'edit/handler/EditToolbar.Edit.js',
			'edit/handler/EditToolbar.Delete.js'
		],
		desc: 'Edit toolbar.',
		deps: ['EditHandlers', 'CommonUI']
	}
};

if (typeof exports !== 'undefined') {
	exports.deps = deps;
}
