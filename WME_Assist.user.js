// ==UserScript==
// @name WME Assist
// @author borman84 (Boris Molodenkov)
// @description This script checks and fixes street name for POI and segments
// @match     https://world.waze.com/editor/*
// @match     https://*.waze.com/editor/*
// @match     https://*.waze.com/*/editor/*
// @match     https://world.waze.com/map-editor/*
// @match     https://world.waze.com/beta_editor/*
// @match     https://www.waze.com/map-editor/*
// @grant     GM_xmlhttpRequest
// @include   https://editor-beta.waze.com/*
// @include   https://*.waze.com/editor/editor/*
// @include   https://*.waze.com/*/editor/*
// @version   0.2.7
// @namespace https://greasyfork.org/users/20609
// ==/UserScript==

function run_wme_assist() {
    var ver = '0.2.7';

    function debug(message) {
        if (!$('#assist_debug').is(':checked')) return;
        console.log("WME ASSIST DEBUG: " + message);
    }

    function info(message) {
        console.log("WME ASSIST INFO: " + message);
    }

    function warning(message) {
        console.log("WME ASSIST WARN: " + message);
    }

    function getWazeApi() {
        var wazeapi = window.Waze;

        if (!wazeapi) return null;
        if (!wazeapi.map) return null;
        if (!wazeapi.model) return null;
        if (!wazeapi.model.countries) return null;
        if (!wazeapi.model.countries.top) return null;

        return wazeapi;
    }

    var Rule = function (comment, func, variant) {
        this.comment = comment;
        this.correct = func;
        this.variant = variant;
    }

    var CustomRule = function (oldname, newname) {
        var title = oldname + ' -> ' + newname;
        this.oldname = oldname;
        this.newname = newname;
        this.custom = true;
        $.extend(this, new Rule(title, function (text) {
            return text.replace(new RegExp(oldname), newname);
        }));
    }

    var ExperimentalRule = function (comment,  func) {
        this.comment = comment;
        this.correct = func;
        this.experimental = true;
    }

    var Rules = function (countryName) {
        var rules_basicRU = function () {
            return [
                new Rule('Unbreak space in street name', function (text) {
                    return text.replace(/\s+/g, ' ');
                }),
                new Rule('ACUTE ACCENT in street name', function (text) {
                    return text.replace(/\u0301/g, '');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пр-т\.?)( |$)/, '$1проспект$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(просп\.?)( |$)/, '$1проспект$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(ул\.?)( |$)/, '$1улица$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пер\.?)( |$)/, '$1переулок$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пр-д\.?)( |$)/, '$1проезд$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пл\.?)( |$)/, '$1площадь$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(ш\.)( |$)/, '$1шоссе$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(б-р)( |$)/, '$1бульвар$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(дор\.)( |$)/, '$1дорога$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(наб\.)( |$)/, '$1набережная$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(-ая)( |$)/, '$1-я$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(-[о|ы|и]й)( |$)/, '$1-й$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(\sЛет)(\s|$)/, '$1 лет$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(№)(\d)/, '$1 $2');
                }),
            ];
        };

        var rules_RU = function () {
            return rules_basicRU().concat([
                new Rule('No space after the word', function (text) {
                    return text.replace(/\.(?!\s)/g, '. ');
                }),
                new Rule('Garbage dot', function (text) {
                    return text.replace(/(^|\s+)\./g, ' ');
                }),
                new Rule('Incorrect street name', function (text) {
                    var text0 = text;
                    if (/Нехая|Тукая|Мая|Барклая|Батырая|Маклая|Бикбая|Амантая|Нечая|Эшпая|Орая|Прикамья|Алтая/.test(text)) return text;
                    text = text.replace(/(улица|набережная|дорога|линия|аллея|площадь|просека|автодорога|эстакада|магистраль|дамба)(\s)(.+[-|а|я|ь]я$)/, '$3 $1');
                    if (text0 != text) text = text.replace(/(.+)(\s)(\d+-я)/, '$3 $1');
                    return text;
                }),
                new Rule('Incorrect street name', function (text) {
                    var text0 = text;
                    if (/Расковой|Дуровой|Космодемьянской|строй|Ковалевской|Борисовой|Давлетшиной|Крупской|Шевцовой|Чайкиной|Богомоловой|Савиной|Попковой/.test(text)) return text;
                    text = text.replace(/(проспект|переулок|проезд|тупик|бульвар|тракт|объезд|заезд|съезд|просек|взвоз|спуск|переезд|квартал|путепровод|мост|обвод|разворот|шлагбаум|обход|подъезд)(\s)(.+[-|и|о|ы]й$)/, '$3 $1');
                    if (text0 != text) text = text.replace(/(.+)(\s)(\d+-й)/, '$3 $1');
                    return text;
                }),
                new Rule('Move status to begin of name', function (text) {
                    return text.replace(/(.*)(улица)(.*)/, '$2 $1 $3');
                }, 'Tula'),
                new ExperimentalRule('Experimental', function (text) {
                    return text.replace(/experimental/, 'corrected_experimental');
                }),
            ]);
        };

        var rules_BY = function () {
            var isStatus = function (str) {
                var list = ['улица', 'переулок', 'проспект', 'проезд',
                            'площадь', 'шоссе', 'бульвар', 'тракт',
                            'тупик', 'спуск', 'вуліца', 'завулак',
                            'праспект', 'праезд', 'плошча', 'шаша'];
                if (list.indexOf(str) > -1) return true;
                return false;
            }

            var isPseudoStatus = function (str) {
                var list = ['шоссе', 'тракт', 'площадь', 'шаша', 'плошча', 'спуск'];
                if (list.indexOf(str) > -1) return true;
                return false;
            }

            var isNumber = function (str) {
                return /([0-9])-[іыйя]/.test(str);
            }

            var replaceParts = function (text) {
                var arr = text.split(' ');
                var result = [];
                var status;
                var number;

                var previousPart = '';
                for (var i = 0; i < arr.length; ++i) {
                    var part = arr[i];

                    if (isStatus(part) && !isPseudoStatus(part)) {
                        status = part;
                    } else if (isNumber(part) && previousPart.toLowerCase() != 'героев') {
                        number = part;
                    } else {
                        result.push(part);
                    }

                    previousPart = part;
                }

                if (status) {
                    result.splice(0, 0, status);
                }

                if (number) {
                    result.push(number);
                }

                return result.join(' ');
            }

            return rules_basicRU().concat([
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(тр-т)( |$)/, '$1тракт$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(вул\.?)( |$)/, '$1вуліца$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(зав)( |$)/, '$1завулак$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(прасп)( |$)/, '$1праспект$3');
                }),

                new Rule('Incorrect street name', function (text) {
                    return text.replace(/-ая/, '-я').replace(/-ой/, '-й');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/([РрНнМмPpHM])-?([0-9])/, function (a, p1, p2) {
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
                new Rule('Incorrect street name', replaceParts),
            ]);
        }

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
            case 'Russia':
                countryRules = rules_RU();
                break;
            case 'Belarus':
                countryRules = rules_BY();
                break;
            default:
                alert('There are not implemented rules for country: ' + name);
                countryRules = [];
            }
            return countryRules.concat(commonRules);
        }

        var rules = [];
        var customRulesNumber = 0;

        var onAdd = function (rule) {}
        var onEdit = function (index, rule) {}
        var onDelete = function (index) {}

        this.onAdd = function (cb) { onAdd = cb }
        this.onEdit = function (cb) { onEdit = cb }
        this.onDelete = function (cb) { onDelete = cb }

        this.onCountryChange = function (name) {
            info('Country was changed to ' + name);
            rules.splice(customRulesNumber, rules.length - customRulesNumber);
            rules = rules.concat(getCountryRules(name));
        }

        this.get = function (index) {
            return rules[index];
        }

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
        }

        var save = function (rules) {
            if (localStorage) {
                localStorage.setItem('assistRulesKey', JSON.stringify(rules.slice(0, customRulesNumber)));
            }
        }

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
        }

        this.push = function (oldname, newname) {
            var rule = new CustomRule(oldname, newname);
            rules.splice(customRulesNumber++, 0, rule);
            onAdd(rule);

            save(rules);
        }

        this.update = function (index, oldname, newname) {
            var rule = new CustomRule(oldname, newname);
            rules[index] = rule;
            onEdit(index, rule);

            save(rules);
        }

        this.remove = function (index) {
            rules.splice(index, 1);
            --customRulesNumber;
            onDelete(index);

            save(rules);
        }
    }

    var ActionHelper = function (wazeapi) {
        var WazeActionUpdateObject = require("Waze/Action/UpdateObject");
        var WazeActionAddOrGetStreet = require("Waze/Action/AddOrGetStreet");
        var WazeActionAddOrGetCity = require("Waze/Action/AddOrGetCity");

        var type2repo = function (type) {
            var map = {
                'venue': wazeapi.model.venues,
                'segment': wazeapi.model.segments
            };
            return map[type];
        }

        this.Select = function (id, type, center, zoom) {
            var select = function () {
                info('select: ' + id);

                var obj = type2repo(type).objects[id];

                wazeapi.model.events.unregister('mergeend', map, select);

                if (obj) {
                    wazeapi.selectionManager.select([obj]);
                } else {
                    wazeapi.model.events.register('mergeend', map, select);
                }

                wazeapi.map.setCenter(center, zoom);
            }

            return select;
        }

        this.isObjectVisible = function (obj) {
            if (!onlyVisible) return true;
            if (obj.geometry)
                return wazeapi.map.getExtent().intersectsBounds(obj.geometry.getBounds());
            return false;
        }

        var addOrGetStreet = function (cityId, name, isEmpty) {
            var foundStreets = wazeapi.model.streets.getByAttributes({
                cityID: cityId,
                name: name,
            });

            if (foundStreets.length == 1)
                return foundStreets[0];

            var city = wazeapi.model.cities.objects[cityId];
            var a = new WazeActionAddOrGetStreet(name, city, isEmpty);
            wazeapi.model.actionManager.add(a);

            return a.street;
        }

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
        }

        var cityMap = {};
        var onlyVisible = false;

        this.newCityID = function (id) {
            var newid = cityMap[id];
            if (newid) return newid;
            return id;
        }

        this.renameCity = function (oldname, newname) {
            var oldcity = wazeapi.model.cities.getByAttributes({name: oldname});

            if (oldcity.length == 0) {
                console.log('City not found: ' + oldname);
                return false;
            }

            var city = oldcity[0];
            var newcity = addOrGetCity(city.countryID, city.stateID, newname);

            cityMap[city.getID()] = newcity.getID();
            onlyVisible = true;

            console.log('Do not forget press reset button and re-enable script');
            return true;
        }

        this.fixProblem = function (problem) {
            var deferred = $.Deferred();

            var fix = function () {
                var obj = type2repo(problem.type).objects[problem.id];
                wazeapi.model.events.unregister('mergeend', map, fix);

                if (obj) {
                    // protect user manual fix
                    var currentValue = wazeapi.model.streets.objects[obj.attributes[problem.attrName]].name;
                    if (problem.reason == currentValue) {
                        var correctStreet = addOrGetStreet(problem.cityId, problem.newStreetName, problem.isEmpty);
                        var request = {};
                        request[problem.attrName] = correctStreet.getID();
                        wazeapi.model.actionManager.add(new WazeActionUpdateObject(obj, request));
                    }
                    deferred.resolve((obj.getID()));
                } else {
                    wazeapi.model.events.register('mergeend', map, fix);
                    wazeapi.map.setCenter(problem.detectPos, problem.zoom);
                }
            }

            fix();

            return deferred.promise();
        }
    }

    var Ui = function () {
        var addon = document.createElement('section');
        addon.innerHTML = '<b>WME Assist</b> v' + ver;

        var section = document.createElement('p');
        section.style.paddingTop = "8px";
        section.style.textIndent = "16px";
        section.id = "assist_options";
        section.innerHTML = '<b>Editor Options</b><br/>' +
            '<label><input type="checkbox" id="assist_enabled" value="0"/> Enable/disable</label><br/>' +
            '<label><input type="checkbox" id="assist_debug" value="0"/> Debug</label><br/>';
        var variant = document.createElement('p');
        variant.id = 'variant_options';
        variant.innerHTML = '<b>Variants</b><br/>' +
            '<label><input type="radio" name="assist_variant" value="Moscow" checked/> Moscow</label><br/>' +
            '<label><input type="radio" name="assist_variant" value="Tula"/> Tula</label><br/>';
        section.appendChild(variant);
        addon.appendChild(section);

        section = document.createElement('p');
        section.style.paddingTop = "8px";
        section.style.textIndent = "16px";
        section.id = "assist_custom_rules";
        $(section)
            .append($('<p>').addClass('message').css({'font-weight': 'bold'}).text('Custom rules'))
            .append($('<button>').prop('id', 'assist_add_custom_rule').addClass('btn btn-default btn-primary').text('Add'))
            .append($('<button>').prop('id', 'assist_edit_custom_rule').addClass('btn btn-default').text('Edit'))
            .append($('<button>').prop('id', 'assist_del_custom_rule').addClass('btn btn-default btn-warning').text('Del'))
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
        $('#user-info > .tab-content').append(addon);

        var selectedCustomRule = -1;

        this.selectedCustomRule = function () {
            return selectedCustomRule;
        }

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
        }

        this.updateCustomRule = function (index, title) {
            $('#assist_custom_rules li.result').eq(index).find('p.additional-info').text(title);
        }

        this.removeCustomRule = function (index) {
            $('#assist_custom_rules li.result').eq(index).remove();
            selectedCustomRule = -1;
        }

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
        }

        this.removeException = function (index) {
            $('#assist_exceptions li.result').eq(index).remove();
        }

        this.showMainWindow = function () {
            $('#WazeMap').css('overflow', 'hidden');
            mainWindow.dialog('open');
            mainWindow.dialog('option', 'position', {
                my: 'right top',
                at: 'right top',
                of: '#WazeMap',
            });
            // Minimize window
            mainWindow.prev('.ui-dialog-titlebar').find('button').click();
        }

        this.hideMainWindow = function () {
            mainWindow.dialog('close');
        }

        $('<div>', {
            id: 'WME_AssistWindow',
            title: 'WME Assist',
        })
            .append($('<div>').css({
                padding: 10,
            })
                    .append($('<button id="assist_fixall_btn" class="btn btn-danger">Fix all</button>'))
                    .append($('<button id="assist_reset_btn" class="btn btn-warning">Reset</button>'))
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
                            .append($('<label>').prop('for', 'oldname').text('Old name'))
                            .append($('<input>', {
                                type: 'text',
                                name: 'oldname',
                                'class': 'text ui-widget-content ui-corner-all',
                                id: 'oldname',
                            }))
                            .append($('<label>').prop('for', 'newname').text('New name'))
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

        var customRuleDialog_Ok = function () {}
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
            resize: function (event, ui) {
                var w = ui.size.width;
                var h = ui.size.height;
                var dx = parseFloat($('#WME_AssistWindow').css('padding-left'));
                var dy = parseFloat($('#WME_AssistWindow').css('padding-top'));
                $('#WME_AssistWindow').width(w - 2*dx);
                $('#WME_AssistWindow').height(h - 2*dy - 50);
                $('#WME_AssistWindow').parent().css('height', 'auto');
            },
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
        })

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
        }

        this.setUnresolvedErrorNum = function (text) {
            $('#assist-error-num').text(text);
        }

        this.setFixedErrorNum = function (text) {
            $('#assist-fixed-num').text(text);
        }

        var escapeId = function (id) {
            return String(id).replace(/\./g, "\\.");
        }

        this.moveToFixedList = function (id) {
            $("#issue-" + escapeId(id)).appendTo($('#assist_fixed_list'));
        }

        this.removeError = function (id) {
            $("#issue-" + escapeId(id)).remove();
        }

        var fixallBtn = $('#assist_fixall_btn');
        var clearfixedBtn = $('#assist_clearfixed_btn');
        var resetBtn = $('#assist_reset_btn');
        var unresolvedList = $('#assist_unresolved_list');
        var fixedList = $('#assist_fixed_list');
        var enableCheckbox = $('#assist_enabled');

        var addCustomRuleBtn = $('#assist_add_custom_rule');
        var editCustomRuleBtn = $('#assist_edit_custom_rule');
        var delCustomRuleBtn = $('#assist_del_custom_rule');

        this.fixallBtn = function () { return fixallBtn }
        this.clearfixedBtn = function () { return clearfixedBtn }
        this.resetBtn = function () { return resetBtn }

        this.unresolvedList = function () { return unresolvedList }
        this.fixedList = function () { return fixedList }

        this.enableCheckbox = function () { return enableCheckbox }
        this.variantRadio = function (value) {
            if (!value) {
                return $('[name=assist_variant]');
            }

            return $('[name=assist_variant][value=' + value + ']');
        }

        this.addCustomRuleBtn = function () { return addCustomRuleBtn }
        this.editCustomRuleBtn = function () { return editCustomRuleBtn }
        this.delCustomRuleBtn = function () { return delCustomRuleBtn }
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
            }

            customRuleDialog.dialog('option', 'title', title);
            customRuleDialog.dialog('open');

            return deferred.promise();
        }
        this.variant = function () {
            return $('[name=assist_variant]:checked')[0].value;
        }
    };

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

    var Application = function (wazeapi) {
        var countryName = function () {
            var id = wazeapi.model.countries.top.id;
            var name = wazeapi.model.countries.objects[id].name;
            return name;
        }

        var country = countryName();

        var action = new ActionHelper(wazeapi);
        var rules = new Rules(country);
        var ui = new Ui();
        var exceptions = new Exceptions();

        exceptions.onAdd(function (name) {
            ui.addException(name, function (index) {
                if (confirm('Delete exception for ' + name + '?')) {
                    exceptions.remove(index);
                }
            });
        });

        exceptions.onDelete(function (index) {
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

        wazeapi.model.events.register('mergeend', map, function () {
            var name = countryName();
            if (name != country) {
                rules.onCountryChange(name);
                country = name;
            }
        });

        exceptions.load();
        rules.load();

        var problems = [];
        var unresolvedIdx = 0;
        var skippedErrors = 0;
        var analyzedIds = [];

        var checkStreet = function (streetID, obj, attrName) {
            var street = wazeapi.model.streets.objects[streetID];

            if (!street) return;

            var detected = false;
            var title;
            var reason;

            if (!street.isEmpty) {
                if (!exceptions.contains(street.name)) {
                    var result = rules.correct(ui.variant(), street.name);
                    var newStreetName = result.value;
                    detected = (newStreetName != street.name);
                    title = obj.type + ': ' + street.name.replace(/\u00A0/g, '■').replace(/^\s|\s$/, '■') + ' ➤ ' + newStreetName;
                    reason = street.name;
                }
            }

            var newCityID = street.cityID;
            if (obj.type != 'segment') {
                newCityID = action.newCityID(street.cityID);
                if (newCityID != street.cityID) {
                    detected = true;
                    title = 'city: ' +
                        wazeapi.model.cities.objects[street.cityID].name + ' -> ' +
                        wazeapi.model.cities.objects[newCityID].name;
                }
            }

            if (detected) {
                var center = obj.geometry.getBounds().getCenterLonLat();
                var zoom = wazeapi.map.getZoom();
                ui.addProblem(obj.getID(), title, action.Select(obj.getID(), obj.type, center, zoom), function () {
                    exceptions.add(reason);

                    var i;
                    for (i = 0; i < problems.length; ++i) {
                        var problem = problems[i];
                        if (problem.reason == reason) {
                            problem.skip = true;
                            ++skippedErrors;
                            ui.removeError(problem.id);
                        }
                    }

                    ui.setUnresolvedErrorNum(problems.length - unresolvedIdx - skippedErrors);
                }, false);

                problems.push({
                    id: obj.getID(),
                    reason: reason,
                    type: obj.type,
                    attrName: attrName,
                    center: center,
                    detectPos: wazeapi.map.getCenter(),
                    zoom: zoom,
                    newStreetName: newStreetName,
                    isEmpty: street.isEmpty,
                    cityId: newCityID,
                    experimental: false,
                });

                ui.setUnresolvedErrorNum(problems.length - unresolvedIdx - skippedErrors);
            }
        }

        var analyze = function () {
            var startTime = new Date().getTime();

            info('start analyze');
            info('venues.num   = ' + wazeapi.model.venues.getObjectArray().length);
            info('segments.num = ' + wazeapi.model.segments.getObjectArray().length);

            var subjects = {
                'segment': {
                    attr: 'primaryStreetID',
                    repo: wazeapi.model.segments,
                },
                'poi': {
                    attr: 'streetID',
                    repo: wazeapi.model.venues,
                }
            };

            for (var k in subjects) {
                var subject = subjects[k];

                for (var id in subject.repo.objects) {
                    if (analyzedIds.indexOf(id) >= 0) continue;

                    var obj = subject.repo.objects[id];
                    if (!action.isObjectVisible(obj)) continue;

                    if (!obj.isAllowed(obj.PERMISSIONS.EDIT_GEOMETRY)) continue;
                    if (obj.attributes.hasClosures) continue;

                    if (typeof obj.attributes.approved != 'undefined' && !obj.attributes.approved) continue;

                    var streetID = obj.attributes[subject.attr];
                    checkStreet(streetID, obj, subject.attr);

                    analyzedIds.push(id);
                }
            }

            info('end analyze: ' + (new Date().getTime() - startTime) + 'ms');
        }

        this.start = function () {
            ui.enableCheckbox().click(function () {
                if (ui.enableCheckbox().is(':checked')) {
                    localStorage.setItem('assist_enabled', true);
                    ui.showMainWindow();

                    info('enabled');

                    var savedVariant = localStorage.getItem('assist_variant');
                    if (savedVariant != null) {
                        ui.variantRadio(savedVariant).prop('checked', true);
                    }

                    analyze();
                    wazeapi.model.events.register('mergeend', map, analyze);
                } else {
                    localStorage.setItem('assist_enabled', false);
                    ui.hideMainWindow();

                    info('disabled');

                    wazeapi.model.events.unregister('mergeend', map, analyze);
                }
            });

            ui.variantRadio().click(function () {
                localStorage.setItem('assist_variant', this.value);

                ui.resetBtn().click();
            });

            if (localStorage.getItem('assist_enabled') == 'true') {
                ui.enableCheckbox().click();
            }

            ui.fixallBtn().click(function () {
                ui.fixallBtn().hide();
                ui.clearfixedBtn().hide();
                ui.resetBtn().hide();

                var arr = [];

                for (var i = unresolvedIdx; i < problems.length; ++i) {
                    if (problems[i].experimental) continue;
                    if (problems[i].skip) continue;

                    var promise = action.fixProblem(problems[i]);
                    promise.done(function (id) {
                        ++unresolvedIdx;

                        ui.setUnresolvedErrorNum(problems.length - unresolvedIdx - skippedErrors);
                        ui.setFixedErrorNum(unresolvedIdx);
                        ui.moveToFixedList(id);
                    });
                    arr.push(promise);
                }

                var deferred = $.when.apply(null, arr);

                deferred.done(function () {
                    ui.fixallBtn().show();
                    ui.clearfixedBtn().show();
                    ui.resetBtn().show();
                });
            });

            ui.clearfixedBtn().click(function () {
                ui.fixedList().empty();
            });

            ui.resetBtn().click(function () {
                ui.fixedList().empty();
                ui.unresolvedList().empty();
                unresolvedIdx = 0;
                skippedErrors = 0;
                problems = [];
                analyzedIds = [];
                ui.setUnresolvedErrorNum(0);
                ui.setFixedErrorNum(0);
                analyze();
            });

            ui.addCustomRuleBtn().click(function () {
                ui.customRuleDialog('Add', {
                    oldname: 'oldname',
                    newname: 'newname'
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
        }

        this.renameCity = action.renameCity;
    };

    function waitForWaze(done) {
        var wazeapi = getWazeApi();

        // Does not get jQuery.ui
        // Relies on WME Toolbox plugin
        if (wazeapi == null || !jQuery.ui) {
            console.log("WME ASSIST: waiting for Waze");
            setTimeout(function () {
                waitForWaze(done);
            }, 500);
            return;
        }

        done(wazeapi);
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

    waitForWaze(function (wazeapi) {
        var app = new Application(wazeapi);
        app.start();
    });
}
var script = document.createElement("script");
script.textContent = run_wme_assist.toString() + ' \n' + 'run_wme_assist();';
script.setAttribute("type", "application/javascript");
document.body.appendChild(script);

//Position "right top" after resize window
$(window).resize(function(){
    $('#WME_AssistWindow').dialog('option', 'position', {
        my: 'right top',
        at: 'right top',
        of: '#WazeMap',
    });
});
