// ==UserScript==
// @name         WME Assist UA
// @version      0.6
// @author       borman84 (Boris Molodenkov), madnut, turbopirate + (add yourself here)
// @description  Check and fix street names for POI and segments. UA fork of original WME Assist
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @resource     customCSS https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @include      /^https:\/\/(www|beta)\.waze\.com(\/\w{2,3}|\/\w{2,3}-\w{2,3}|\/\w{2,3}-\w{2,3}-\w{2,3})?\/editor\b/
// @namespace    https://github.com/waze-ua/wme-assist-ua
// ==/UserScript==

var WME_Assist = WME_Assist || {};
GM_addStyle(GM_getResourceText("customCSS"));

WME_Assist.debug = function (message) {
    if (!$('#assist_debug').is(':checked')) return;
    console.log("%cWME ASSIST UA (D):", 'color: #808080; font-weight: bold', message);
};

WME_Assist.info = function (message) {
    console.log("%cWME ASSIST UA (I):", 'color: #10bc01; font-weight: bold', message);
};

WME_Assist.warning = function (message) {
    console.log("%cWME ASSIST UA (W):", 'color: #e52f02; font-weight: bold', message);
};

WME_Assist.series = function (array, start, action, alldone) {
    var helper = function (i) {
        if (i < array.length) {
            action(array[i], function () {
                helper(i + 1);
            });
        } else {
            if (alldone) {
                alldone();
            }
        }
    };

    helper(start);
};

function run_wme_assist() {
    var ver = GM_info.script.version;

    var debug = WME_Assist.debug;
    var info = WME_Assist.info;
    var warning = WME_Assist.warning;

    var Rule = function (comment, func, variant) {
        this.comment = comment;
        this.correct = func;
        this.variant = variant;
    };

    var CustomRule = function (oldname, newname) {
        var title = '/' + oldname + '/ ➤ ' + newname;
        this.oldname = oldname;
        this.newname = newname;
        this.custom = true;
        $.extend(this, new Rule(title, function (text) {
            return text.replace(new RegExp(oldname), newname);
        }));
    };

    var ExperimentalRule = function (comment,  func) {
        this.comment = comment;
        this.correct = func;
        this.experimental = true;
    };

    var Rules = function (countryName) {
        var rules_basicCommon = function () {
            return [
                new Rule('Unbreak space in street name', function (text) {
                    return text.replace(/\s+/g, ' ');
                }),
                new Rule('ACUTE ACCENT in street name', function (text) {
                    return text.replace(/\u0301|\u0300/g, '');
                }),
                new Rule('Dash in street name', function (text) {
                    return text.replace(/\u2010|\u2011|\u2012|\u2013|\u2014|\u2015|\u2043|\u2212|\u2796/g, '-');
                }),
                new Rule('No space after the word', function (text) {
                    return text.replace(/\.(?!\s)/g, '. ');
                }),
                new Rule('No space after the >', function (text) {
                    return text.replace(/>(?!\s)/g, '> ');
                }),
                new Rule('Garbage dot', function (text) {
                    return text.replace(/(^|\s+)\./g, '$1');
                }),
            ];
        };

        var rules_UA = function () {
            var hasCyrillic = function(s) {return s.search(/[а-яіїєґ]/i) != -1;};
            var hasShortStatus = function(s) { return s.search(/( |^)(вул\.|просп\.|мкрн\.|наб\.|пров\.|ст\.|пр\.|дор\.|б-р|р-н)( |$)/i) != -1; };
            var hasLongStatus = function(s) { return s.search(/( |^)(площа|алея|шосе|тракт|узвіз|тупик|міст|в\'їзд|виїзд|виїзд|розворот|трамвай|залізниця|майдан|заїзд|траса|шляхопровід|шлях|завулок|квартал)( |$)/i) != -1; };
            var hasSpecialStatus = function(s) { return s.search(/( |^)([РНТМ](-[0-9]+)+|[EОС][0-9]+)( |$)|^(|до|на|>) /i) != -1; };
            var hasInternationalName = function(s) {return s.search(/^E[0-9]+$/i) != -1; };
            var hasStatus = function(s) { return (hasShortStatus(s) || hasLongStatus(s) || hasSpecialStatus(s)); };

            // ATTENTION: Rule order is important!
            return rules_basicCommon().concat([
                new Rule('Fix english characters in name', function (t) {
                    return !hasCyrillic(t) || hasInternationalName(t) ? t : t.replace(/[AaBCcEeHIiKkMOoPpTXxYy]/g, function (c) {
                        return {
                            'A': 'А',
                            'a': 'а',
                            'B': 'В',
                            'C': 'С',
                            'c': 'с',
                            'E': 'Е',
                            'e': 'е',
                            'H': 'Н',
                            'I': 'І',
                            'i': 'і',
                            'K': 'К',
                            'k': 'к',
                            'M': 'М',
                            'O': 'О',
                            'o': 'о',
                            'P': 'Р',
                            'p': 'р',
                            'T': 'Т',
                            'X': 'Х',
                            'x': 'х',
                            'Y': 'У',
                            'y': 'у'
                        }[c];
                    });
                }),
                new Rule('Delete space in initials', function (text) {
                    return text.replace(/(^| +)([А-ЯІЇЄ]\.) ([А-ЯІЇЄ]\.)/, '$1$2$3');
                }),
                new Rule('Incorrect characters in street name', function (t) {
                    // This rule should be before renaming rules or they couldn't see some errors
                    return t
                        .replace(/[@#№$,^!:;*"?<]/, ' ').replace(/ {2,}/, ' ')
                        .replace(/[`’]/g, '\'');
                }),
                new Rule('Incorrect language', function (t) {
                    // Translate full russian names to full ukrainian
                    // and next rules will shorten them if necessary
                    return t
                        .replace(/(^| )в?улица( |$)/i, '$1вулиця$2')
                        .replace(/(^| )спуск( |$)/i, '$1узвіз$2')
                        .replace(/(^| )(т)расса( |$)/i, '$1$2раса$3')
                        .replace(/(^| )(п)ереулок( |$)/i, '$1$2ровулок$3')
                        .replace(/(^| )(п)роезд( |$)/i, '$1$2роїзд$3')
                        .replace(/(^| )(п)лощадь( |$)/i, '$1$2лоща$3')
                        .replace(/(^| )(ш)оссе( |$)/i, '$1$2осе$3')
                        .replace(/(^| )(с)танция( |$)/i, '$1$2танція$3')
                        .replace(/(^| )(а)ллея( |$)/i, '$1$2лея$3')
                        .replace(/(^| )(н)абережная( |$)/i, '$1$2абережна$3')
                        .replace(/(^| )(м)икрорайон( |$)/i, '$1$2ікрорайон$3')
                        .replace(/(^| )(л)иния( |$)/i, '$1$2інія$3')
                        .replace(/(^| )(а)кадемика( |$)/i, '$1$2кадеміка$3')
                        .replace(/(^| )(а)дмирала( |$)/i, '$1$2дмірала$3')
                        .replace(/ и /i, ' та ');
                }),
                new Rule('Mistake in short status', function (t) {
                    return t
                        .replace(/(^| )(буль?в?\.?|б-р\.)( |$)/i, '$1б-р$3')
                        .replace(/(^| )(?:пр-к?т|п(?:р|о)?сп)\.?( |$)/i, '$1просп.$2')
                        .replace(/(^| )пр-з?д\.?( |$)/i, '$1пр.$2')
                        .replace(/(^| )ул\.?( |$)/i, '$1вул.$2')
                        .replace(/(^| )р-н\.( |$)/i, '$1р-н$2')
                        .replace(/(^| )пер\.?( |$)/i, '$1пров.$2')
                        .replace(/(^| )(пров|просп|пр|вул|ст|мкрн|наб|дор)( |$)/i, '$1$2.$3');
                }),
                new Rule('Long status must be short', function (t) {
                    // Do short status only if there no other shorten statuses in name
                    return hasShortStatus(t) ? t : t
                        .replace(/(^| )район( |$)/i, '$1р-н$2')
                        .replace(/(^| )бульвар( |$)/i, '$1б-р$2')
                        .replace(/(^| )провулок( |$)/i, '$1пров.$2')
                        .replace(/(^| )проспект( |$)/i, '$1просп.$2')
                        .replace(/(^| )проїзд( |$)/i, '$1пр.$2')
                        .replace(/(^| )вулиця( |$)/i, '$1вул.$2')
                        .replace(/(^| )станція( |$)/i, '$1ст.$2')
                        .replace(/(^| )мікрорайон( |$)/i, '$1мкрн.$2')
                        .replace(/(^| )набережна( |$)/i, '$1наб.$2')
                        .replace(/(^| )дорог[аи]( |$)/i, '$1дор.$2');
                }),
                new Rule('Shorten street name or status must be long', function (t) {
                    return t
                        .replace(/(^| )туп\.?( |$)/i, '$1тупик$2')
                        .replace(/(^| )тр-т\.?( |$)/i, '$1тракт$2')
                        .replace(/(^| )(сп\.?|узв\.?|узвоз)( |$)/i, '$1узвіз$3')
                        .replace(/(^| )пл\.?( |$)/i, '$1площа$2')
                        .replace(/(^| )ал\.?( |$)/i, '$1алея$2')
                        .replace(/(^| )ш\.?( |$)/i, '$1шосе$2')
                        .replace(/(^| )ген\.?( |$)/i, '$1Генерала$2')
                        .replace(/(^| )див\.?( |$)/i, '$1Дивізії$2')
                        .replace(/(^| )ак\.?( |$)/i, '$1Академіка$2')
                        .replace(/(^| )марш\.?( |$)/i, '$1Маршала$2')
                        .replace(/(^| )адм\.?( |$)/i, '$1Адмірала$2');
                }),
                new Rule('Incorrect number ending', function (t) {
                    return t
                        .replace(/-[гштм]а/, '-а')
                        .replace(/-[ыоиі]й/, '-й')
                        .replace(/-тя/, '-я')
                        .replace(/-ая/, '-а');
                }),
                new Rule('Incorrect highway name', function (text) {
                    return text.replace(/([РрНнМмPpHM])[-\s]*([0-9]{2})/, function (a, p1, p2) {
                        p1 = p1
                            .replace('р', 'Р')
                            .replace('н', 'Н')
                            .replace('м', 'М')
                            .replace('P', 'Р')
                            .replace('p', 'Р')
                            .replace('H', 'Н')
                            .replace('M', 'М');

                        return p1 + '-' + p2;
                    });
                }),
                new Rule('Incorrect local street name', function (text) {
                    return text.replace(/([ТтT])[-\s]*([0-9]{2})[-\s]*([0-9]{2})/, function (a, p1, p2, p3) {
                        p1 = p1
                            .replace('т', 'Т')
                            .replace('T', 'Т');

                        return p1 + '-' + p2 + '-' + p3;
                    });
                }),
                new Rule('Incorrect international highway name', function (text) {
                    return text.replace(/^ *[eе][- ]*([0-9]+)/i, 'E$1');
                }),
                new Rule('Incorrect local road name', function (text) {
                    return text.replace(/([OoCcОоСс])[-\s]*([0-9]+)[-\s]*([0-9]+)[-\s]*([0-9]+)/, function (a, p1, p2, p3, p4) {
                        p1 = p1
                            .replace('o', 'О')
                            .replace('O', 'О')
                            .replace('c', 'С')
                            .replace('C', 'С');

                        return p1 + p2 + p3 + p4;
                    });
                }),

                new Rule('Fix status', function (t) {
                    return hasStatus(t) ? t : 'вул. ' + t;
                }, 'Ukraine'),

                new Rule('Move status to begin of name', function (text) {
                    var excludeList = /(?: |^)до |(?: |^)на /;
                    if (! new RegExp(excludeList).test(text)) {
                        return text.replace(/(.*)(вул\.)(.*)/, '$2 $1 $3');
                    }
                    return text;
                }, 'Ukraine'),
            ]);
        };

        var getCountryRules = function (name) {
            var commonRules = [
                // Following rules must be at the end because
                // previous rules might insert additional spaces
                new Rule('Redundant space in street name', function (text) {
                    return text.replace(/[ ]+/g, ' ');
                }),
                new Rule('Space at the begin of street name', function (text) {
                    return text.replace(/^[ ]*/, '');
                }),
                new Rule('Space at the end of street name', function (text) {
                    return text.replace(/[ ]*$/, '');
                }),
            ];
            var countryRules;
            info('Get rules for country: ' + name);
            switch (name) {
                case 'Ukraine':
                    countryRules = rules_UA();
                    break;
                default:
                    info('There are not implemented rules for country: ' + name);
                    countryRules = [];
            }
            return countryRules.concat(commonRules);
        };

        var rules = [];
        var customRulesNumber = 0;

        var onAdd = function (rule) {};
        var onEdit = function (index, rule) {};
        var onDelete = function (index) {};

        this.onAdd = function (cb) { onAdd = cb; };
        this.onEdit = function (cb) { onEdit = cb; };
        this.onDelete = function (cb) { onDelete = cb; };

        this.onCountryChange = function (name) {
            info('Country was changed to ' + name);
            rules.splice(customRulesNumber, rules.length - customRulesNumber);
            rules = rules.concat(getCountryRules(name));
        };

        this.get = function (index) {
            return rules[index];
        };

        this.correct = function (variant, text) {
            var newtext = text;
            var experimental = false;

            for (var i = 0; i < rules.length; ++i) {
                var rule = rules[i];

                if (rule.experimental && !this.experimental) continue;

                if (rule.variant && rule.variant != variant) continue;

                var previous = newtext;
                newtext = rule.correct(newtext);
                var changed = (previous != newtext);
                if (rule.experimental && previous != newtext) {
                    experimental = true;
                }
                previous = newtext;
                // if (rule.custom && changed) {
                //     // prevent result overwriting by common rules
                //     break;
                // }
            }

            return {
                value: newtext,
                experimental: experimental
            };
        };

        var save = function (rules) {
            if (localStorage) {
                localStorage.setItem('assistRulesKey', JSON.stringify(rules.slice(0, customRulesNumber)));
            }
        };

        this.load = function () {
            if (localStorage) {
                var str = localStorage.getItem('assistRulesKey');
                if (str) {
                    var arr = JSON.parse(str);
                    for (var i = 0; i < arr.length; ++i) {
                        var rule = arr[i];
                        this.push(rule.oldname, rule.newname);
                    }
                }
            }

            rules = rules.concat(getCountryRules(countryName));
        };

        this.push = function (oldname, newname) {
            var rule = new CustomRule(oldname, newname);
            rules.splice(customRulesNumber++, 0, rule);
            onAdd(rule);

            save(rules);
        };

        this.update = function (index, oldname, newname) {
            var rule = new CustomRule(oldname, newname);
            rules[index] = rule;
            onEdit(index, rule);

            save(rules);
        };

        this.remove = function (index) {
            rules.splice(index, 1);
            --customRulesNumber;
            onDelete(index);

            save(rules);
        };
    };

    var ActionHelper = function () {
        var WazeActionUpdateObject = require("Waze/Action/UpdateObject");
        var WazeActionAddOrGetStreet = require("Waze/Action/AddOrGetStreet");
        var WazeActionAddOrGetCity = require("Waze/Action/AddOrGetCity");

        var ui;

        var type2repo = function (type) {
            var map = {
                'venue': Waze.model.venues,
                'segment': Waze.model.segments
            };
            return map[type];
        };

        this.setUi = function (u) {
            ui = u;
        };

        this.Select = function (id, type, center, zoom) {
            var attemptNum = 10;

            var select = function () {
                info('select: ' + id);

                var obj = type2repo(type).objects[id];

                Waze.model.events.unregister('mergeend', map, select);

                if (obj) {
                    Waze.selectionManager.select([obj]);
                } else if (--attemptNum > 0) {
                    Waze.model.events.register('mergeend', map, select);
                }

                WME_Assist.debug("Attempt number left: " + attemptNum);

                Waze.map.setCenter(center, zoom);
            };

            return select;
        };

        this.isObjectVisible = function (obj) {
            if (!onlyVisible) return true;
            if (obj.geometry)
                return Waze.map.getExtent().intersectsBounds(obj.geometry.getBounds());
            return false;
        };

        var addOrGetStreet = function (cityId, name, isEmpty) {
            var foundStreets = Waze.model.streets.getByAttributes({
                cityID: cityId,
                name: name,
            });

            if (foundStreets.length == 1)
                return foundStreets[0];

            var city = Waze.model.cities.objects[cityId];
            var a = new WazeActionAddOrGetStreet(name, city, isEmpty);
            Waze.model.actionManager.add(a);

            return a.street;
        };

        var addOrGetCity = function (countryID, stateID, cityName) {
            var foundCities = Waze.model.cities.getByAttributes({
                countryID: countryID,
                stateID: stateID,
                name : cityName
            });

            if (foundCities.length == 1)
                return foundCities[0];

            var state = Waze.model.states.objects[stateID];
            var country = Waze.model.countries.objects[countryID];
            var a = new WazeActionAddOrGetCity(state, country, cityName);
            Waze.model.actionManager.add(a);
            return a.city;
        };

        var cityMap = {};
        var onlyVisible = false;

        this.newCityID = function (id) {
            var newid = cityMap[id];
            if (newid) return newid;
            return id;
        };

        this.renameCity = function (oldname, newname) {
            var oldcity = Waze.model.cities.getByAttributes({name: oldname});

            if (oldcity.length === 0) {
                console.log('City not found: ' + oldname);
                return false;
            }

            var city = oldcity[0];
            var newcity = addOrGetCity(city.countryID, city.stateID, newname);

            cityMap[city.getID()] = newcity.getID();
            onlyVisible = true;

            console.log('Do not forget press reset button and re-enable script');
            return true;
        };

        this.fixProblem = function (problem) {
            var deferred = $.Deferred();
            var attemptNum = 10; // after that we decide that object was removed

            var fix = function () {
                var obj = type2repo(problem.object.type).objects[problem.object.id];
                Waze.model.events.unregister('mergeend', map, fix);

                if (obj) {
                    // protect user manual fix
                    var currentValue = Waze.model.streets.objects[obj.attributes[problem.attrName]].name;
                    if (problem.reason == currentValue) {
                        var correctStreet = addOrGetStreet(problem.cityId, problem.newStreetName, problem.isEmpty);
                        var request = {};
                        request[problem.attrName] = correctStreet.getID();
                        Waze.model.actionManager.add(new WazeActionUpdateObject(obj, request));
                    } else {
                        ui.updateProblem(problem.object.id, '(user fix: ' + currentValue + ')');
                    }
                    deferred.resolve(obj.getID());
                } else if (--attemptNum <= 0) {
                    ui.updateProblem(problem.object.id, '(was not fixed. Deleted?)');
                    deferred.resolve(problem.object.id);
                } else {
                    Waze.model.events.register('mergeend', map, fix);
                    Waze.map.setCenter(problem.detectPos, problem.zoom);
                }

                WME_Assist.debug('Attempt number left: ' + attemptNum);
            };

            fix();

            return deferred.promise();
        };
    };

    var Ui = function (countryName) {
        var addon = document.createElement('section');
        addon.innerHTML = '<b>WME Assist UA</b> v' + ver;

        var section = document.createElement('p');
        section.style.paddingTop = "8px";
        section.style.textIndent = "16px";
        section.id = "assist_options";
        section.innerHTML = '<b>Editor Options</b><br/>' +
            '<label><input type="checkbox" id="assist_enabled" value="0"/> Enable/disable</label><br/>' +
            '<label><input type="checkbox" id="assist_skip_alt" value="0"/> Do not check alternative names</label><br/>' +
            '<label><input type="checkbox" id="assist_debug" value="0" checked/> Debug</label><br/>';
        var variant = document.createElement('p');
        variant.id = 'variant_options';
        // adopt city names for Ukraine
        if (countryName == 'Ukraine') {
            variant.innerHTML = '<b>Variants</b><br/>' +
                '<label><input type="radio" name="assist_variant" value="Ukraine" checked/> Ukraine</label><br/>' +
                '<label><input type="radio" name="assist_variant" value="Lviv"/> Lviv</label><br/>';
        } else {
            variant.innerHTML = '<b>Variants</b><br/>' +
                '<label><input type="radio" name="assist_variant" value="Moscow" checked/> Moscow</label><br/>' +
                '<label><input type="radio" name="assist_variant" value="Tula"/> Tula</label><br/>';
        }
        section.appendChild(variant);
        addon.appendChild(section);

        section = document.createElement('p');
        section.style.paddingTop = "8px";
        section.style.textIndent = "16px";
        section.id = "assist_custom_rules";
        $(section)
            .append($('<p>').addClass('message').css({'font-weight': 'bold'}).text('Custom rules'))
            .append($('<div>').addClass('btn-toolbar')
            .append($('<button>').prop('id', 'assist_add_custom_rule').addClass('btn btn-default btn-primary').text('Add'))
            .append($('<button>').prop('id', 'assist_edit_custom_rule').addClass('btn btn-default').text('Edit'))
            .append($('<button>').prop('id', 'assist_del_custom_rule').addClass('btn btn-default btn-warning').text('Del')))
            .append($('<ul>').addClass('result-list'));
        addon.appendChild(section);

        section = document.createElement('p');
        section.style.paddingTop = "8px";
        section.style.textIndent = "16px";
        section.id = "assist_exceptions";
        $(section)
            .append($('<p title="Right click on error in list to add">').addClass('message').css({'font-weight': 'bold'}).text('Exceptions'))
            .append($('<ul>').addClass('result-list'));
        addon.appendChild(section);

        var newtab = document.createElement('li');
        newtab.innerHTML = '<a href="#sidepanel-assist" data-toggle="tab">Assist</a>';
        $('#user-info #user-tabs .nav-tabs').append(newtab);

        addon.id = "sidepanel-assist";
        addon.className = "tab-pane";
        $('#user-info > div > .tab-content').append(addon);

        var selectedCustomRule = -1;

        this.selectedCustomRule = function () {
            return selectedCustomRule;
        };

        this.addCustomRule = function (title) {
            var thisrule = $('<li>').addClass('result').click(function () {
                selectedCustomRule = $('#assist_custom_rules li.result').index(thisrule);
                info('index: ' + selectedCustomRule);
                $('#assist_custom_rules li.result').css({'background-color': ''});
                $('#assist_custom_rules li.result').removeClass('active');
                $(this).css({'background-color': 'lightblue'});
                $(this).addClass('active');
            }).hover(function () {
                $(this).css({
                    cursor: 'pointer',
                    'background-color': 'lightblue'
                });
            }, function () {
                $(this).css({
                    cursor: 'auto'
                });
                if (!$(this).hasClass('active')) {
                    $(this).css({
                        'background-color': ''
                    });
                }
            })
            .append($('<p>').addClass('additional-info clearfix').text(title))
            .appendTo($('#assist_custom_rules ul.result-list'));
        };

        this.updateCustomRule = function (index, title) {
            $('#assist_custom_rules li.result').eq(index).find('p.additional-info').text(title);
        };

        this.removeCustomRule = function (index) {
            $('#assist_custom_rules li.result').eq(index).remove();
            selectedCustomRule = -1;
        };

        this.addException = function (name, del) {
            var thisrule = $('<li>').addClass('result').click(function () {
                var index = $('#assist_exceptions li.result').index(thisrule);
                del(index);
            }).hover(function () {
                $(this).css({
                    cursor: 'pointer',
                    'background-color': 'lightblue'
                });
            }, function () {
                $(this).css({
                    cursor: 'auto'
                });
                if (!$(this).hasClass('active')) {
                    $(this).css({
                        'background-color': ''
                    });
                }
            })
            .append($('<p>').addClass('additional-info clearfix').text(name))
            .appendTo($('#assist_exceptions ul.result-list'));
        };

        this.removeException = function (index) {
            $('#assist_exceptions li.result').eq(index).remove();
        };

        this.showMainWindow = function () {
            $('#WazeMap').css('overflow', 'hidden');
            mainWindow.dialog('open');
            mainWindow.dialog('option', 'position', {
                my: 'right top',
                at: 'right-50 top',
                of: '#WazeMap',
            });
            // Minimize window
            mainWindow.prev('.ui-dialog-titlebar').find('button').click();
        };

        this.hideMainWindow = function () {
            mainWindow.dialog('close');
        };

        $('<div>', {
            id: 'WME_AssistWindow',
            title: 'WME Assist',
        })
            .append($('<div>').css({
            padding: 10,
        })
                    .append($('<button id="assist_fixall_btn" class="btn btn-danger">Fix all</button>'))
                    .append($('<button id="assist_scanarea_btn" class="btn btn-warning">Scan area</button>'))
                    .append($('<button id="assist_clearfixed_btn" class="btn btn-success">Clear fixed</button>'))
                    .append($('<h2>Unresolved issues</h2>').css({
            'font-size': '100%',
            'font-weight': 'bold',
        }))
                    .append($('<ol id="assist_unresolved_list"></ol>').css({
            border: '1px solid lightgrey',
            'padding-top': 2,
            'padding-bottom': 2,
        })))
            .append($('<div>').css({
            padding: 10,
        })
                    .append($('<h2>Fixed issues</h2>').css({
            'font-size': '100%',
            'font-weight': 'bold',
        }))
                    .append($('<ol id="assist_fixed_list"></ol>').css({
            border: '1px solid lightgrey',
            'padding-top': 2,
            'padding-bottom': 2,
        })))
            .appendTo($('#WazeMap'));

        $('<div>').prop('id', 'assist_custom_rule_dialog')
            .append($('<p>All form fields are required</p>'))
            .append($('<form>')
                    .append($('<fieldset>')
                            .append($('<label>').prop('for', 'oldname').text('RegExp'))
                            .append($('<input>', {
            type: 'text',
            name: 'oldname',
            'class': 'text ui-widget-content ui-corner-all',
            id: 'oldname',
        }))
                            .append($('<label>').prop('for', 'newname').text('Replace text'))
                            .append($('<input>', {
            type: 'text',
            name: 'newname',
            'class': 'text ui-widget-content ui-corner-all',
            id: 'newname',
        }))
                           )
                   )
            .appendTo($('#map'));


        $('#assist_custom_rule_dialog label').css({display: 'block'});
        $('#assist_custom_rule_dialog input').css({display: 'block', width: '100%'});

        var customRuleDialog_Ok = function () {};
        var customRuleDialog = $('#assist_custom_rule_dialog').dialog({
            autoOpen: false,
            height: 300,
            width: 350,
            modal: true,
            buttons: {
                Ok: function () {
                    customRuleDialog_Ok();
                    customRuleDialog.dialog('close');
                },
                Cancel: function () {
                    customRuleDialog.dialog('close');
                }
            }
        });

        var mainWindow = $('#WME_AssistWindow').dialog({
            autoOpen: false,
            appendTo: $('#WazeMap'),
            width: 500,
            draggable: true,
            height: 600,
            dragStop: function () {
                $('#WME_AssistWindow').parent().css('height', 'auto');
            }
        });
        mainWindow.parent('.ui-dialog').css({
            'zIndex': 1040,
            'opacity': '0.9',
        });
        mainWindow.prev('.ui-dialog-titlebar').css('background','lightblue');
        mainWindow.prev('.ui-dialog-titlebar').find('.ui-dialog-title').append($('<span> - </span>'));
        mainWindow.prev('.ui-dialog-titlebar').find('.ui-dialog-title')
            .append($('<span>', {
            id: 'assist-error-num',
            title: 'Number of unresolved issues',
            text: 0,
        }).css({color: 'red'}));
        mainWindow.prev('.ui-dialog-titlebar').find('.ui-dialog-title').append($('<span> / </span>'));
        mainWindow.prev('.ui-dialog-titlebar').find('.ui-dialog-title')
            .append($('<span>', {
            id: 'assist-fixed-num',
            title: 'Number of fixed issues',
            text: 0,
        }).css({color: 'green'}));
        mainWindow.prev('.ui-dialog-titlebar').find('.ui-dialog-title').append($('<span> - </span>'));
        mainWindow.prev('.ui-dialog-titlebar').find('.ui-dialog-title')
            .append($('<span>', {
            id: 'assist-scan-progress',
            title: 'Scan progress',
            text: 0,
        }).css({color: 'blue'}));

        // Hack jquery ui dialog
        var icon = mainWindow.prev('.ui-dialog-titlebar').find('span.ui-icon');
        if (!icon.hasClass('ui-icon-minusthick')) {
            icon.addClass('ui-icon-minusthick');
        }
        if (icon.hasClass('ui-icon-closethick')) {
            icon.removeClass('ui-icon-closethick');
        }
        var btn = mainWindow.prev('.ui-dialog-titlebar').find('button');
        mainWindow.prev('.ui-dialog-titlebar').find('button').unbind('click');
        var visible = true;
        var height;
        mainWindow.prev('.ui-dialog-titlebar').find('button').click(function () {
            if ($('#WME_AssistWindow').is(':visible')) {
                $('#WME_AssistWindow').hide();
                btn.prop('title', 'maximize');

                icon.removeClass('ui-icon-minusthick');
                icon.addClass('ui-icon-arrow-4-diag');
            } else {
                $('#WME_AssistWindow').show();
                btn.prop('title', 'minimize');

                icon.addClass('ui-icon-minusthick');
                icon.removeClass('ui-icon-arrow-4-diag');
            }
        });

        var self = this;

        this.addProblem = function (id, text, func, exception, experimental) {
            var problem = $('<li>')
            .prop('id', 'issue-' + id)
            .append($('<a>', {
                href: "javascript:void(0)",
                text: text,
                click: function (event) {
                    func(event);
                },
                contextmenu: function (event) {
                    exception(event);
                    event.preventDefault();
                    event.stopPropagation();
                },
            }))
            .appendTo($('#assist_unresolved_list'));

            if (experimental) {
                problem.children().css({color: 'red'}).prop('title', 'Experimental rule');
            }
        };

        this.updateProblem = function (id, text) {
            var a = $('li#issue-' + escapeId(id) + ' > a');
            a.text(a.text() + ' ' + text);
        };

        this.setUnresolvedErrorNum = function (text) {
            $('#assist-error-num').text(text);
        };

        this.setFixedErrorNum = function (text) {
            $('#assist-fixed-num').text(text);
        };

        this.setScanProgress = function (text) {
            $('#assist-scan-progress').text(text);
        };

        var escapeId = function (id) {
            return String(id).replace(/\./g, "\\.");
        };

        this.moveToFixedList = function (id) {
            $("#issue-" + escapeId(id)).appendTo($('#assist_fixed_list'));
        };

        this.removeError = function (id) {
            $("#issue-" + escapeId(id)).remove();
        };

        var fixallBtn = $('#assist_fixall_btn');
        var clearfixedBtn = $('#assist_clearfixed_btn');
        var scanAreaBtn = $('#assist_scanarea_btn');
        var unresolvedList = $('#assist_unresolved_list');
        var fixedList = $('#assist_fixed_list');
        var enableCheckbox = $('#assist_enabled');
        var skipAltCheckbox = $('#assist_skip_alt');
        var debugCheckbox = $('#assist_debug');

        var addCustomRuleBtn = $('#assist_add_custom_rule');
        var editCustomRuleBtn = $('#assist_edit_custom_rule');
        var delCustomRuleBtn = $('#assist_del_custom_rule');

        this.fixallBtn = function () { return fixallBtn; };
        this.clearfixedBtn = function () { return clearfixedBtn; };
        this.scanAreaBtn = function () { return scanAreaBtn; };

        this.unresolvedList = function () { return unresolvedList; };
        this.fixedList = function () { return fixedList; };

        this.enableCheckbox = function () { return enableCheckbox; };
        this.skipAltCheckbox = function () { return skipAltCheckbox; };
        this.debugCheckbox = function () { return debugCheckbox; };
        this.variantRadio = function (value) {
            if (!value) {
                return $('[name=assist_variant]');
            }

            return $('[name=assist_variant][value=' + value + ']');
        };

        this.addCustomRuleBtn = function () { return addCustomRuleBtn; };
        this.editCustomRuleBtn = function () { return editCustomRuleBtn; };
        this.delCustomRuleBtn = function () { return delCustomRuleBtn; };
        this.customRuleDialog = function (title, params) {
            var deferred = $.Deferred();

            if (params) {
                customRuleDialog.find('#oldname').val(params.oldname);
                customRuleDialog.find('#newname').val(params.newname);
            }

            customRuleDialog_Ok = function () {
                deferred.resolve({
                    oldname: customRuleDialog.find('#oldname').val(),
                    newname: customRuleDialog.find('#newname').val(),
                });
            };

            customRuleDialog.dialog('option', 'title', title);
            customRuleDialog.dialog('open');

            return deferred.promise();
        };
        this.variant = function () {
            return $('[name=assist_variant]:checked')[0].value;
        };
    };

    var Application = function () {
        var scaner = new WME_Assist.Scaner();
        var analyzer = new WME_Assist.Analyzer();

        var FULL_ZOOM_LEVEL = 5;

        var scanForZoom = function (zoom) {
            scaner.scan(Waze.map.calculateBounds(), zoom, function (bounds, zoom, data) {
                console.log(data);
                analyzer.analyze(bounds, zoom, data, function (obj, title, reason) {
                    ui.addProblem(obj.id, title, action.Select(obj.id, obj.type, obj.center, zoom), function () {
                        analyzer.addException(reason, function (id) {
                            ui.removeError(id);
                            ui.setUnresolvedErrorNum(analyzer.unresolvedErrorNum());
                        });
                    }, false);

                    ui.setUnresolvedErrorNum(analyzer.unresolvedErrorNum());
                });
            }, function (progress) {
                ui.setScanProgress(Math.round(progress) + '%');
            });
        };

        var fullscan = function () {
            scanForZoom(FULL_ZOOM_LEVEL);
        };

        var scan = function () {
            scanForZoom(Waze.map.getZoom());
        };

        var countryName = function () {
            var id = Waze.model.countries.top.id;
            var name = Waze.model.countries.objects[id].name;
            return name;
        };

        var country = countryName();

        var action = new ActionHelper();
        var rules = new Rules(country);
        var ui = new Ui(country);

        analyzer.setRules(rules);
        analyzer.setActionHelper(action);

        action.setUi(ui);

        analyzer.onExceptionAdd(function (name) {
            ui.addException(name, function (index) {
                if (confirm('Delete exception for ' + name + '?')) {
                    analyzer.removeException(index);
                }
            });
        });

        analyzer.onExceptionDelete(function (index) {
            ui.removeException(index);
        });

        //        rules.experimental = true;

        rules.onAdd(function (rule) {
            ui.addCustomRule(rule.comment);
        });

        rules.onEdit(function (index, rule) {
            ui.updateCustomRule(index, rule.comment);
        });

        rules.onDelete(function (index) {
            ui.removeCustomRule(index);
        });

        Waze.model.events.register('mergeend', map, function () {
            var name = countryName();
            if (name != country) {
                rules.onCountryChange(name);
                country = name;
            }
        });

        analyzer.loadExceptions();
        rules.load();

        this.start = function () {
            ui.enableCheckbox().click(function () {
                if (ui.enableCheckbox().is(':checked')) {
                    localStorage.setItem('assist_enabled', true);
                    ui.showMainWindow();

                    info('enabled');

                    var savedVariant = localStorage.getItem('assist_variant');
                    if (savedVariant !== null) {
                        ui.variantRadio(savedVariant).prop('checked', true);
                        analyzer.setVariant(ui.variant());
                    }

                    scan();
                    Waze.model.events.register('mergeend', map, scan);
                } else {
                    localStorage.setItem('assist_enabled', false);
                    ui.hideMainWindow();

                    info('disabled');

                    Waze.model.events.unregister('mergeend', map, scan);
                }
            });

            ui.skipAltCheckbox().click(function () {
                if (ui.skipAltCheckbox().is(':checked')) {
                    localStorage.setItem('assist_skip_alt', true);
                } else {
                    localStorage.setItem('assist_skip_alt', false);
                }
            });

            ui.debugCheckbox().click(function () {
                if (ui.debugCheckbox().is(':checked')) {
                    localStorage.setItem('assist_debug', true);
                } else {
                    localStorage.setItem('assist_debug', false);
                }
            });

            ui.variantRadio().click(function () {
                localStorage.setItem('assist_variant', this.value);

                analyzer.setVariant(ui.variant());
                ui.scanAreaBtn().click();
            });

            if (localStorage.getItem('assist_enabled') == 'true') {
                ui.enableCheckbox().click();
            }
            if (localStorage.getItem('assist_skip_alt') == 'true') {
                ui.skipAltCheckbox().click();
            }
            if (localStorage.getItem('assist_debug') == 'true') {
                ui.debugCheckbox().click();
            }

            ui.fixallBtn().click(function () {
                ui.fixallBtn().hide();
                ui.clearfixedBtn().hide();
                ui.scanAreaBtn().hide();

                Waze.model.events.unregister('mergeend', map, scan);

                setTimeout(function () {
                    analyzer.fixAll(function (id) {
                        ui.setUnresolvedErrorNum(analyzer.unresolvedErrorNum());
                        ui.setFixedErrorNum(analyzer.fixedErrorNum());
                        ui.moveToFixedList(id);
                    }, function () {
                        ui.fixallBtn().show();
                        ui.clearfixedBtn().show();
                        ui.scanAreaBtn().show();

                        Waze.model.events.register('mergeend', map, scan);
                    });
                }, 0);
            });

            ui.clearfixedBtn().click(function () {
                ui.fixedList().empty();
            });

            ui.scanAreaBtn().click(function () {
                ui.fixedList().empty();
                ui.unresolvedList().empty();

                analyzer.reset();

                ui.setUnresolvedErrorNum(0);
                ui.setFixedErrorNum(0);

                fullscan();
            });

            ui.addCustomRuleBtn().click(function () {
                ui.customRuleDialog('Add', {
                    oldname: '',
                    newname: ''
                }).done(function (response) {
                    rules.push(response.oldname, response.newname);
                });
            });

            ui.editCustomRuleBtn().click(function () {
                var id = ui.selectedCustomRule();
                if (id >= 0) {
                    ui.customRuleDialog('Edit', {
                        oldname: rules.get(id).oldname,
                        newname: rules.get(id).newname
                    }).done(function (response) {
                        rules.update(id, response.oldname, response.newname);
                    });
                } else {
                    alert('Custom rule is not selected');
                }
            });

            ui.delCustomRuleBtn().click(function () {
                var id = ui.selectedCustomRule();
                if (id >= 0) {
                    rules.remove(id);
                } else {
                    alert('Custom rule is not selected');
                }
            });

            window.assist = this;
        };

        this.renameCity = action.renameCity;
    };

    function isWazeReady() {
        if (!Waze || !Waze.map || !Waze.model || !Waze.model.countries || !Waze.model.countries.top)
            return false;
        return true;
    }

    function waitForWaze(done) {
        if (!isWazeReady() || !jQuery.ui) {
            setTimeout(function () { waitForWaze(done); }, 500);
            return;
        }

        done();
    }

    function getByAttr(obj, attr) {
        return obj.getByAttributes().filter(function (e) {
            for (var key in attr) {
                if (e.attributes[key] != attr[key]) {
                    return false;
                }
            }

            return true;
        });
    }

    WME_Assist.info("Waiting for Waze");

    waitForWaze(function () {
        WME_Assist.info("Ready to work!");
        var app = new Application();
        app.start();
    });
}

WME_Assist.Analyzer = function () {
    var Exceptions = function () {
        var exceptions = [];

        var onAdd = function (name) {}
        var onDelete = function (index) {}

        var save = function (exception) {
            if (localStorage) {
                localStorage.setItem('assistExceptionsKey', JSON.stringify(exceptions));
            }
        }

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
        }

        this.contains = function (name) {
            if (exceptions.indexOf(name) == -1) return false;
            return true;
        }

        this.add = function (name) {
            exceptions.push(name);
            save(exceptions);
            onAdd(name);
        }

        this.remove = function (index) {
            exceptions.splice(index, 1);
            save(exceptions);
            onDelete(index);
        }

        this.onAdd = function (cb) { onAdd = cb }
        this.onDelete = function (cb) {onDelete = cb }
    }

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
    }

    var getFixedErrorNum = function () {
        return unresolvedIdx;
    }

    this.unresolvedErrorNum = getUnresolvedErrorNum;
    this.fixedErrorNum = getFixedErrorNum;

    this.setRules = function (r) {
        rules = r;
    }

    this.setActionHelper = function (a) {
        action = a;
    }

    this.loadExceptions = function () {
        exceptions.load();
    }

    this.onExceptionAdd = function (cb) {
        exceptions.onAdd(cb);
    }

    this.onExceptionDelete = function (cb) {
        exceptions.onDelete(cb);
    }

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
    }

    this.removeException = function (i) {
        exceptions.remove(i);
    }

    this.setVariant = function (v) {
        variant = v;
    }

    this.reset = function () {
        analyzedIds = [];
        problems = [];
        unresolvedIdx = 0;
        skippedErrors = 0;
    }

    this.fixAll = function (onefixed, allfixed) {
        WME_Assist.series(problems, unresolvedIdx, function (p, next) {
            if (p.skip) {
                next();
                return;
            }

            action.fixProblem(p).done(function (id) {
                ++unresolvedIdx;
                onefixed(id);

                setTimeout(next, 0);
            });
        }, allfixed);
    }

    var checkStreet = function (bounds, zoom, streetID, obj, attrName, onProblemDetected) {
        var userlevel = Waze.loginManager.user.normalizedLevel;
        var street = Waze.model.streets.get(streetID);

        if (!street) return;

        var detected = false;
        var skip = false;
        var title = '';
        var reason;

        if (!street.isEmpty) {
            if (!exceptions.contains(street.name)) {
                try {
                    var result = rules.correct(variant, street.name);
                    var newStreetName = result.value;
                    detected = (newStreetName != street.name);
                    if (obj.type == 'venue') title = 'POI: ';
                    if (attrName == 'streetIDs') {
                        title = 'ALT: ';
                        skip = true;
                    }
                    if (obj.lockRank && obj.lockRank >= userlevel) {
                        title = '(L' + (obj.lockRank + 1) + ') ' + title;
                        skip = true;
                    }
                    title = title + street.name.replace(/\u00A0/g, '■').replace(/^\s|\s$/, '■') + ' ➤ ' + newStreetName;
                    reason = street.name;
                } catch (err) {
                    WME_Assist.warning('Street name "' + street.name + '" causes error in rules');
                    return;
                }
            }
        }

        var newCityID = street.cityID;
        // if (obj.type != 'segment') {
        //     newCityID = action.newCityID(street.cityID);
        //     if (newCityID != street.cityID) {
        //         detected = true;
        //         title = 'city: ' +
        //             Waze.model.cities.objects[street.cityID].name + ' -> ' +
        //             Waze.model.cities.objects[newCityID].name;
        //     }
        // }

        if (detected) {
            var gj = new OL.Format.GeoJSON();
            var geometry = gj.parseGeometry(obj.geometry);
            var objCenter = geometry.getBounds().getCenterLonLat().transform(Waze.map.displayProjection, Waze.map.getProjectionObject());
            var boundsCenter = bounds.clone().getCenterLonLat().transform(Waze.map.displayProjection, Waze.map.getProjectionObject());
            obj.center = objCenter;

            problems.push({
                object: obj,
                reason: reason,
                attrName: attrName,
                detectPos: boundsCenter,
                zoom: zoom,
                newStreetName: newStreetName,
                isEmpty: street.isEmpty,
                cityId: newCityID,
                experimental: false,
                skip: skip,
            });

            onProblemDetected(obj, title, reason);
        }
    }

    this.analyze = function (bounds, zoom, data, onProblemDetected) {
        //var permissions = new require("Waze/Permissions");
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

                if (obj.hasClosures) continue;

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
    }
};

WME_Assist.Scaner = function () {
    var model = Waze.model;
    var map = Waze.map;
    var controller = Waze.controller;

    var getData = function (e, cb) {
        console.log(e);
        $.get(Waze.Config.paths.features, e).done(cb);
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

    var zoomToRoadType = function (zoom) {
        var s = Waze.Config.segments.zoomToRoadType[zoom] || [];
        if (-1 === s) {
            s = W.Config.segments.allTypes;
        }

        var r = [];
        Object.keys(Waze.Config.segments.zoomToRoadType).forEach(function (t) {
            t = parseInt(t, 10);
            var i = s.contains(t);
            if (i) {
                r.push(t);
            }
        })

        return (r.length == 0) ? null : { roadTypes: s.toString() }
    }

    this.scan = function (bounds, zoom, analyze, progress) {
        var boundsArray = splitExtent(bounds, zoom);
        var completed = 0;

        if (boundsArray.length > 20 && !confirm('Script will scan ' + boundsArray.length + ' peaces. Are you OK?')) {
            return;
        }

        progress = progress || function () {}

        WME_Assist.series(boundsArray, 0, function (bounds, next) {
            var peace = bounds.transform(map.getProjectionObject(), map.displayProjection);

            var e = {
                bbox: peace.toBBOX(),
                language: I18n.locale,
                venueFilter: '1',
                venueLevel: Waze.Config.venues.zoomToSize[zoom],
            };

            OL.Util.extend(e, zoomToRoadType(zoom));

            getData(e, function (data) {
                analyze(peace, zoom, data);
                progress(++completed*100/boundsArray.length);
                next();
            });
        });
    }
};

run_wme_assist();

