window.WME_Assist = window.WME_Assist || {};
var WME_Assist = window.WME_Assist;

WME_Assist.Analyzer = function (wazeapi) {
    var Exceptions = function () {
        var exceptions = [];

        var onAdd = function (name) {};
        var onDelete = function (index) {};

        var save = function (exceptions) {
            if (localStorage) {
                localStorage.setItem('assistExceptionsKey', JSON.stringify(exceptions));
            }
        };

        this.load = function () {
            if (localStorage) {
                var str = localStorage.getItem('assistExceptionsKey');
                if (str) {
                    var arr = JSON.parse(str);
                    for (var i = 0; i < arr.length; ++i) {
                        var exception = arr[i];
                        this.add(exception);
                    }
                }
            }
        };

        this.contains = function (name) {
            if (exceptions.indexOf(name) == -1) return false;
            return true;
        };

        this.add = function (name) {
            exceptions.push(name);
            save(exceptions);
            onAdd(name);
        };

        this.remove = function (index) {
            exceptions.splice(index, 1);
            save(exceptions);
            onDelete(index);
        };

        this.onAdd = function (cb) { onAdd = cb; };
        this.onDelete = function (cb) {onDelete = cb; };
    };

    var analyzedIds = [];
    var problems = [];
    var unresolvedIdx = 0;
    var skippedErrors = 0;
    var variant;
    var exceptions = new Exceptions();
    var rules;
    var action;

    var getUnresolvedErrorNum = function () {
        return problems.length - unresolvedIdx - skippedErrors;
    };

    var getFixedErrorNum = function () {
        return unresolvedIdx;
    };

    this.unresolvedErrorNum = getUnresolvedErrorNum;
    this.fixedErrorNum = getFixedErrorNum;

    this.setRules = function (r) {
        rules = r;
    };

    this.setActionHelper = function (a) {
        action = a;
    };

    this.loadExceptions = function () {
        exceptions.load();
    };

    this.onExceptionAdd = function (cb) {
        exceptions.onAdd(cb);
    };

    this.onExceptionDelete = function (cb) {
        exceptions.onDelete(cb);
    };

    this.addException = function (reason, cb) {
        exceptions.add(reason);

        var i;
        for (i = 0; i < problems.length; ++i) {
            var problem = problems[i];
            if (problem.reason == reason) {
                problem.skip = true;
                ++skippedErrors;

                cb(problem.object.id);
            }
        }
    };

    this.removeException = function (i) {
        exceptions.remove(i);
    };

    this.setVariant = function (v) {
        variant = v;
    };

    this.reset = function () {
        analyzedIds = [];
        problems = [];
        unresolvedIdx = 0;
        skippedErrors = 0;
    };

    this.fixAll = function (oneFixed, allFixed) {
        WME_Assist.series(problems, unresolvedIdx, function (p, next) {
            if (p.skip) {
                next();
                return;
            }

            action.fixProblem(p).done(function (id) {
                ++unresolvedIdx;
                oneFixed(id);

                setTimeout(next, 0);
            });
        }, allFixed);
    };

    this.fixSelected = function (listToFix, oneFixed, allFixed) {
        WME_Assist.series(problems, unresolvedIdx, function (p, next) {
            if (listToFix.indexOf(p.object.id + '_' + p.streetID) == -1) {
                next();
                return;
            }
            if (p.skip) {
                next();
                return;
            }

            action.fixProblem(p).done(function (id) {
                ++unresolvedIdx;
                oneFixed(id);

                setTimeout(next, 0);
            });
        }, allFixed);
    };
    
    var checkStreet = function (bounds, zoom, streetID, obj, attrName, onProblemDetected) {
        var userlevel = wazeapi.loginManager.user.rank + 1;
        var street = wazeapi.model.streets.getObjectById(streetID);

        if (!street) return;

        var detected = false;
        var skip = false;
        var title = '';
        var reason;
        var newStreetName;
        
        if (!street.isEmpty) {
            if (!exceptions.contains(street.name)) {
                try {
                    var result = rules.correct(variant, street.name);
                    newStreetName = result.value;
                    detected = (newStreetName != street.name);
                    if (obj.type == 'venue') {
                        title = 'POI: ';
                    }
                    // alternative names
                    if (attrName == 'streetIDs') {
                        title = 'ALT: ';
                    }
                    // if user has lower rank, just show the segment, but no fix allowed
                    if (obj.lockRank && obj.lockRank >= userlevel) {
                        title = '(L' + (obj.lockRank + 1) + ') ' + title;
                        skip = true;
                    }
                    // show segments with closures, but lock them from fixing
                    if (obj.hasClosures) {
                        title = '(🚧) ' + title;
                        skip = true;
                    }
                    title = title + street.name.replace(/\u00A0/g, '■').replace(/^\s|\s$/, '■');
                    // for "detect only rules" we have no replacement to show
                    if (!newStreetName) {
                        skip = true;
                    }
                    else {
                        title = title + ' ➤ ' + newStreetName;
                    }
                    if (skip) {
                        title = '🔒 ' + title;
                    }
                    reason = street.name;
                } catch (err) {
                    WME_Assist.warning('Street name "' + street.name + '" causes error in rules');
                    return;
                }
            }
        }

        if (detected) {
            var gj = new OpenLayers.Format.GeoJSON();
            var geometry = gj.parseGeometry(obj.geometry);
            var objCenter = geometry.getBounds().getCenterLonLat().transform(wazeapi.map.displayProjection, wazeapi.map.getProjectionObject());
            var boundsCenter = bounds.clone().getCenterLonLat().transform(wazeapi.map.displayProjection, wazeapi.map.getProjectionObject());
            obj.center = objCenter;

            problems.push({
                object: obj,
                reason: reason,
                attrName: attrName,
                detectPos: boundsCenter,
                zoom: zoom,
                newStreetName: newStreetName,
                isEmpty: street.isEmpty,
                cityId: street.cityID,
                streetID: streetID,
                experimental: false,
                skip: skip,
            });

            onProblemDetected(obj.id + '_' + streetID, obj, title, reason);
        }
    };

    this.analyze = function (bounds, zoom, data, onProblemDetected) {
        var startTime = new Date().getTime();
        var analyzeAlt = true;
        
        WME_Assist.info('start analyze');

        var subjects = {
            'segment': {
                attr: 'primaryStreetID',
                name: 'segments'
            },
            'venue': {
                attr: 'streetID',
                name: 'venues'
            }
        };

        if (localStorage) {
            if (localStorage.getItem('assist_skip_alt') == 'true') {
                analyzeAlt = false;
            }
        }
        
        for (var k in subjects) {
            var subject = subjects[k];
            var subjectData = data[subject.name];

            if (!subjectData) continue;

            var objects = subjectData.objects;

            for (var i = 0; i < objects.length; ++i) {
                var obj = objects[i];
                var id = obj.id;

                obj.type = k;

                if (analyzedIds.indexOf(id) >= 0) continue;

                if (typeof obj.approved != 'undefined' && !obj.approved) continue;

                checkStreet(bounds, zoom, obj[subject.attr], obj, subject.attr, onProblemDetected);
                
                // add ugly support for alternative names
                if (subject.name == 'segments' && analyzeAlt)
                {
                    for (var j = 0, n = obj.streetIDs.length; j < n; j++) {
                        checkStreet(bounds, zoom, obj.streetIDs[j], obj, 'streetIDs', onProblemDetected);
                    }
                }
                analyzedIds.push(id);
            }
        }

        WME_Assist.info('end analyze: ' + (new Date().getTime() - startTime) + 'ms');
    };
};
