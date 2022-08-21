window.WME_Assist = window.WME_Assist || {};
var WME_Assist = window.WME_Assist;

WME_Assist.Scanner = function (wazeapi) {
    var map = wazeapi.map;

    var ROAD_TYPE = {
        STREET: 1,
        PRIMARY_STREET: 2,
        FREEWAY: 3,
        RAMP: 4,
        WALKING_TRAIL: 5,
        MAJOR_HIGHWAY: 6,
        MINOR_HIGHWAY: 7,
        OFF_ROAD: 8,
        WALKWAY: 9,
        PEDESTRIAN_BOARDWALK: 10,
        FERRY: 15,
        STAIRWAY: 16,
        PRIVATE_ROAD: 17,
        RAILROAD: 18,
        RUNWAY_TAXIWAY: 19,
        PARKING_LOT_ROAD: 20,
        ALLEY: 22
    };

    var zoomToRoadType = function(e) {
        if (e < 14) {
            return [];
        }
        switch (e) {
            case 14:
                return [ROAD_TYPE.PRIMARY_STREET, ROAD_TYPE.FREEWAY, ROAD_TYPE.RAMP, ROAD_TYPE.MAJOR_HIGHWAY, ROAD_TYPE.MINOR_HIGHWAY, ROAD_TYPE.FERRY];
            case 15:
                return [ROAD_TYPE.PRIMARY_STREET, ROAD_TYPE.FREEWAY, ROAD_TYPE.RAMP, ROAD_TYPE.MAJOR_HIGHWAY, ROAD_TYPE.MINOR_HIGHWAY, ROAD_TYPE.OFF_ROAD, ROAD_TYPE.WALKWAY, ROAD_TYPE.PEDESTRIAN_BOARDWALK, ROAD_TYPE.FERRY, ROAD_TYPE.STAIRWAY, ROAD_TYPE.PRIVATE_ROAD, ROAD_TYPE.RAILROAD, ROAD_TYPE.RUNWAY_TAXIWAY, ROAD_TYPE.PARKING_LOT_ROAD, ROAD_TYPE.ALLEY];
            default:
                return Object.values(ROAD_TYPE);
        }
    };
    var zoomToVenueLevel = function(e) {
        switch (e) {
            case 12:
                return 1;
            case 13:
                return 2;
            case 14:
            case 15:
            case 16:
                return 3;
            case 17:
            case 18:
            case 19:
            case 20:
            case 21:
            case 22:
                return 4;
            default:
                return null;
        }
    };

    var getData = function (e, cb) {
        WME_Assist.debug(e);
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
                var bounds = new OpenLayers.Bounds();
                bounds.extend(new OpenLayers.LonLat(x, y));
                bounds.extend(new OpenLayers.LonLat(x + dx, y + dy));

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
            var peace = bounds.transform(map.getProjectionObject(), 'EPSG:4326');

            var e = {
                bbox: peace.toBBOX(),
                language: I18n.locale,
                venueFilter: '3',
                venueLevel: zoomToVenueLevel(zoom),
            };
            var z = {
                roadTypes: zoomToRoadType(zoom).toString()
            };
            OpenLayers.Util.extend(e, z);

            getData(e, function (data) {
                analyze(peace, zoom, data);
                progress(++completed * 100 / boundsArray.length);
                next();
            });
        });
    };
};
