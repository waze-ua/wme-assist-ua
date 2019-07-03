window.WME_Assist = window.WME_Assist || {};
var WME_Assist = window.WME_Assist;

WME_Assist.Scanner = function (wazeapi) {
    var map = wazeapi.map;

    var zoomToRoadType = function(e) {
        switch (e) {
            case 0:
            case 1:
                return [];
            case 2:
                return [2, 3, 4, 6, 7, 15];
            case 3:
                return [2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            default:
                return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
        }
    };
    var zoomToVenueLevel = function(e) {
        switch (e) {
            case 0:
                return 1;
            case 1:
                return 2;
            case 2:
            case 3:
            case 4:
                return 3;
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
                return 4;
            default:
                return null
        }
    };

    var getData = function (e, cb) {
        console.log(e);
        $.get(wazeapi.Config.paths.features, e).done(cb);
    };

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
    };
/*
    var zoomToRoadType = function (zoom) {
        var s = wazeapi.Config.segments.zoomToRoadType[zoom] || [];
        if (-1 === s) {
            s = W.Config.segments.allTypes;
        }

        var r = [];
        Object.keys(wazeapi.Config.segments.zoomToRoadType).forEach(function (t) {
            t = parseInt(t, 10);
            var i = s.indexOf(t);
            if (i > -1) {
                r.push(t);
            }
        });

        return (r.length === 0) ? null : { roadTypes: s.toString() };
    };
*/
    this.scan = function (bounds, zoom, analyze, progress) {
        var boundsArray = splitExtent(bounds, zoom);
        var completed = 0;

        if (boundsArray.length > 20 && !confirm('Script will scan ' + boundsArray.length + ' peaces. Are you OK?')) {
            return;
        }

        progress = progress || function () {};

        WME_Assist.series(boundsArray, 0, function (bounds, next) {
            var peace = bounds.transform(map.getProjectionObject(), map.displayProjection);

            var e = {
                bbox: peace.toBBOX(),
                language: I18n.locale,
                venueFilter: '3',
                venueLevel: zoomToVenueLevel(zoom),
            };

            OL.Util.extend(e, zoomToRoadType(zoom));

            getData(e, function (data) {
                analyze(peace, zoom, data);
                progress(++completed * 100 / boundsArray.length);
                next();
            });
        });
    };
};
