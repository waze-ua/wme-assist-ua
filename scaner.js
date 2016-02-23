var WME_Assist = WME_Assist || {}

WME_Assist.Scaner = function (wazeapi) {
    var model = wazeapi.model;
    var map = wazeapi.map;
    var controller = wazeapi.controller;

    var getData = function (e, cb) {
        console.log(e);
        $.get(wazeapi.Config.paths.features, e).done(cb);
    }

    var splitExtent = function (extent, zoom) {
        var result = [];

        var ratio = map.getResolution() / map.getResolutionForZoom(zoom);
        var dx = extent.getWidth() / ratio;
        var dy = extent.getHeight() / ratio;

        var x, y;
        for (x = extent.left; x < extent.right; x += dx) {
            for (y = extent.bottom; y < extent.top; y += dy) {
                var bounds = new OpenLayers.Bounds();
                bounds.extend(new OpenLayers.LonLat(x, y));
                bounds.extend(new OpenLayers.LonLat(x + dx, y + dy));

                result.push(bounds);
            }
        }

        return result;
    }

    var iterateArray = function (array, action) {
        var helper = function (array, i, action) {
            action(array[i++], function () {
                if (i < array.length) {
                    helper(array, i, action);
                }
            });
        }

        helper(array, 0, action);
    }

    this.scan = function (bounds, zoom, analyze) {
        var boundsArray = splitExtent(bounds, zoom);

        iterateArray(boundsArray, function (bounds, next) {
            var peace = bounds.transform(map.getProjectionObject(), controller.segmentProjection);

            var e = {
                bbox: peace.toBBOX(),
                language: I18n.locale,
                venueFilter: '0',
                venueLevel: wazeapi.Config.venues.zoomToSize[zoom],
                roadTypes: wazeapi.Config.segments.allTypes.toString(),
            };

            getData(e, function (data) {
                analyze(peace, zoom, data);
                next();
            });
        });
    }
}
