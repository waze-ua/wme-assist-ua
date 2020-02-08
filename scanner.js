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
                return null;
        }
    };

    var getData = function (e, cb) {
        console.log(e);
        $.get(wazeapi.Config.paths.features, e).done(cb);
    };

    var splitExtent = function (extent, zoom) {
        var result = [];

        var ratio = 1; //map.getResolution() / map.getResolutionForZoom(zoom); //FIXME: temporary commented, because getResolutionForZoom() is gone
        var dx = extent.getWidth() / ratio;
        var dy = extent.getHeight() / ratio;

        var x, y;
        for (x = extent.left; x < extent.right; x += dx) {
            for (y = extent.bottom; y < extent.top; y += dy) {
                var bounds = new OL.Bounds();
                bounds.extend(new OL.LonLat(x, y));
                bounds.extend(new OL.LonLat(x + dx, y + dy));

                result.push(bounds);
            }
        }

        return result;
    };

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
            var z = {
                roadTypes: zoomToRoadType(zoom).toString()
            };
            OL.Util.extend(e, z);

            getData(e, function (data) {
                analyze(peace, zoom, data);
                progress(++completed * 100 / boundsArray.length);
                next();
            });
        });
    };
};
