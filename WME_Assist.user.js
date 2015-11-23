// ==UserScript==
// @name WME Assist
// @author borman84 (Boris Molodenkov)
// @description This script checks and fixes POI street name
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
// @version   0.0.3
// ==/UserScript==

function run_wme_assist() {
    var ver = '0.0.3';

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

    var Rule = function (comment, func) {
        this.comment = comment;
        this.correct = func;
    }

    var CustomRule = function (oldname, newname) {
        var title = oldname + ' -> ' + newname;
        this.oldname = oldname;
        this.newname = newname;
        $.extend(this, new Rule(title, function (text) {
            return text.replace(oldname, newname);
        }));
    }

    var Rules = function (countryName) {
        var rules_RU = function () {
            return [
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
            ];
        };

        var rules_BY = function () {
            return rules_RU().concat([
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
            ]);
        }

        var getCountryRules = function (name) {
            info('Get rules for country: ' + name);
            switch (name) {
            case 'Russia':
                return rules_RU();
                break;
            case 'Belarus':
                return rules_BY();
                break;
            default:
                alert('There are not implemented rules for country: ' + name);
                return [];
            }
        }

        var rules = getCountryRules(countryName);
        var customRulesIndex = rules.length;

        var onAdd = function (rule) {}
        var onEdit = function (index, rule) {}
        var onDelete = function (index) {}

        this.onAdd = function (cb) { onAdd = cb }
        this.onEdit = function (cb) { onEdit = cb }
        this.onDelete = function (cb) { onDelete = cb }

        this.onCountryChange = function (name) {
            info('Country was changed to ' + name);
            var newrules = getCountryRules(name);
            rules.splice(0, customRulesIndex);
            customRulesIndex = newrules.length;
            rules = newrules.concat(rules);
        }

        this.get = function (index) {
            return rules[index + customRulesIndex];
        }

        this.correct = function (text) {
            var newtext = text;

            for (var i = 0; i < rules.length; ++i) {
                var rule = rules[i];
                newtext = rule.correct(newtext);
            }

            return newtext;
        }

        var save = function (rules) {
            if (localStorage) {
                localStorage.setItem('assistRulesKey', JSON.stringify(rules.slice(customRulesIndex)));
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
        }

        this.push = function (oldname, newname) {
            var rule = new CustomRule(oldname, newname);
            rules.push(rule);
            onAdd(rule);

            save(rules);
        }

        this.update = function (index, oldname, newname) {
            var rule = new CustomRule(oldname, newname);
            rules[index + customRulesIndex] = rule;
            onEdit(index, rule);

            save(rules);
        }

        this.remove = function (index) {
            rules.splice(index + customRulesIndex, 1);
            onDelete(index);

            save(rules);
        }
    }

    var ActionHelper = function (wazeapi) {
        var WazeActionUpdateObject = require("Waze/Action/UpdateObject");
        var WazeActionAddOrGetStreet = require("Waze/Action/AddOrGetStreet");

        this.Select = function (id, center, zoom) {
            var select = function () {
                info('select: ' + id);

                var obj = wazeapi.model.venues.objects[id];

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

        var addOrGetStreet = function (cityId, name) {
            var foundStreets = wazeapi.model.streets.getByAttributes({
                cityID: cityId,
                name: name,
            });

            if (foundStreets.length == 1)
                return foundStreets[0];

            var city = wazeapi.model.cities.objects[cityId];
            var a = new WazeActionAddOrGetStreet(name, city, false);
            wazeapi.model.actionManager.add(a);

            return a.street;
        }

        this.fixProblem = function (problem) {
            var deferred = $.Deferred();

            var fix = function () {
                var obj = wazeapi.model.venues.objects[problem.id];
                wazeapi.model.events.unregister('mergeend', map, fix);

                if (obj) {
                    var correctStreet = addOrGetStreet(problem.cityId, problem.newStreetName);
                    wazeapi.model.actionManager.add(new WazeActionUpdateObject(obj, {streetID: correctStreet.getID()}));
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
            '<label><input type="checkbox" id="assist_visibility" value="1"/> Show/hide window</label><br/>' +
            '<label><input type="checkbox" id="assist_debug" value="0"/> Debug</label><br/>';
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
        section.id = "assist_minireport";
        section.innerHTML = '<b>Mini report</b><br/>' +
            '<p>Unresolved errors: <span id="assist-error-num">0</span></p>' +
            '<p>Fixed errors: <span id="assist-fixed-num">0</span></p>' +
            '<button id="assist_fixall_btn" class="btn btn-danger">Fix all</button>' +
            '<button id="assist_reset_btn" class="btn btn-warning">Reset</button>' +
            '<button id="assist_clearfixed_btn" class="btn btn-success">Clear fixed</button>';
        addon.appendChild(section);

        var newtab = document.createElement('li');
        newtab.innerHTML = '<a href="#sidepanel-assist" data-toggle="tab">Assist</a>';
        $('#user-info .nav-tabs').append(newtab);

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

        $('<div>').prop('id', 'WME_AssistWindow').css({
            position: 'fixed',
            'z-index': 1000,
            left: 715,
            top: 88,
            'background-color': 'white',
            '-webkit-box-shadow': '1px 1px 5px 0px rgba(50, 50, 50, 0.75)',
            '-moz-box-shadow':    '1px 1px 5px 0px rgba(50, 50, 50, 0.75)',
            'box-shadow':         '1px 1px 5px 0px rgba(50, 50, 50, 0.75)',
            border: '1px solid black',
            'border-radius': 5,
            padding: 0,
            margin: 0,
            overflow: 'hidden',
            opacity: 0.9,
        })
            .append($('<h1>WME Assist</h1>').css({
                cursor: 'move',
                'font-size': '110%',
                'font-weight': 'bold',
                padding: 10,
                margin: 0,
                'border-bottom': '1px solid black',
                'background-color': 'lightblue',
            }))
            .append($('<div>').css({
                padding: 10,
            })
                    .append($('<h2>Unresolved issues</h2>').css({
                        'font-size': '100%',
                        'font-weight': 'bold',
                    }))
                    .append($('<ol id="assist_unresolved_list"></ol>').css({
                        'min-width': 300,
                        'max-height': 200,
                        border: '1px solid lightgrey',
                        overflow: 'auto',
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
                        'min-width': 300,
                        'max-height': 200,
                        border: '1px solid lightgrey',
                        overflow: 'auto',
                        'padding-top': 2,
                        'padding-bottom': 2,
                    })))
            .appendTo($('#map'));

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

        this.addProblem = function (id, text, func) {
            $('<li>')
                .prop('id', 'issue-' + id)
                .append($('<a>', {
                    href: "javascript:void(0)",
                    text: text,
                    click: func
                }))
                .appendTo($('#assist_unresolved_list'));
        }

        this.setUnresolvedErrorNum = function (text) {
            $('#assist-error-num').text(text);
        }

        this.setFixedErrorNum = function (text) {
            $('#assist-fixed-num').text(text);
        }

        var escapeId = function (id) {
            return id.replace(/\./g, "\\.");
        }

        this.moveToFixedList = function (id) {
            $("#issue-" + escapeId(id)).appendTo($('#assist_fixed_list'));
        }

        var fixallBtn = $('#assist_fixall_btn');
        var clearfixedBtn = $('#assist_clearfixed_btn');
        var resetBtn = $('#assist_reset_btn');
        var unresolvedList = $('#assist_unresolved_list');
        var fixedList = $('#assist_fixed_list');
        var enableCheckbox = $('#assist_enabled');
        var showWindowCheckbox = $('#assist_visibility');
        var mainWindow = $('#WME_AssistWindow');

        var addCustomRuleBtn = $('#assist_add_custom_rule');
        var editCustomRuleBtn = $('#assist_edit_custom_rule');
        var delCustomRuleBtn = $('#assist_del_custom_rule');

        this.fixallBtn = function () { return fixallBtn }
        this.clearfixedBtn = function () { return clearfixedBtn }
        this.resetBtn = function () { return resetBtn }

        this.unresolvedList = function () { return unresolvedList }
        this.fixedList = function () { return fixedList }

        this.enableCheckbox = function () { return enableCheckbox }
        this.showWindowCheckbox = function () { return showWindowCheckbox }

        this.window = function () { return mainWindow }

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

        mainWindow.hide();
        mainWindow.draggable({handle: 'h1'});

        var pos_x = $(document).width()/2;
        var pos_y = $(document).height()/2;

        mainWindow.css({top: pos_y, left: pos_x});
    };

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

        rules.load();

        var problems = [];
        var unresolvedIdx = 0;
        var analyzedIds = [];

        var analyze = function () {
            info('start analyze');
            info('venues.num   = ' + wazeapi.model.venues.getObjectArray().length);
            info('segments.num = ' + wazeapi.model.segments.getObjectArray().length);

            for (var id in wazeapi.model.venues.objects) {
                if (analyzedIds.indexOf(id) >= 0) continue;

                var venue = wazeapi.model.venues.objects[id];

                if (!venue.isAllowed(venue.PERMISSIONS.EDIT_GEOMETRY)) continue;

                if (!venue.attributes.approved) continue;

                var streetID = venue.attributes.streetID;

                var street = wazeapi.model.streets.objects[streetID];

                if (!street) continue;

                if (street.isEmpty) continue;

                var newStreetName = rules.correct(street.name);

                if (newStreetName != street.name) {
                    info(venue.attributes.id);
                    info(street.name);

                    var title = 'POI street: ' + street.name + ' -> ' + newStreetName;
                    var center = venue.geometry.getBounds().getCenterLonLat();
                    var zoom = Waze.map.getZoom();
                    ui.addProblem(venue.attributes.id, title, action.Select(id, center, zoom));

                    problems.push({
                        id: id,
                        center: center,
                        detectPos: wazeapi.map.getCenter(),
                        zoom: zoom,
                        newStreetName: newStreetName,
                        cityId: street.cityID,
                    });

                    ui.setUnresolvedErrorNum(problems.length - unresolvedIdx);
                }

                analyzedIds.push(id);
            }

            info('end analyze');
        }

        this.start = function () {
            ui.enableCheckbox().click(function () {
                if (ui.enableCheckbox().is(':checked')) {
                    info('enabled');

                    analyze();
                    wazeapi.model.events.register('mergeend', map, analyze);
                } else {
                    info('disabled');

                    wazeapi.model.events.unregister('mergeend', map, analyze);
                }
            });

            ui.showWindowCheckbox().click(function () {
                if (ui.showWindowCheckbox().is(':checked')) {
                    ui.window().show();
                } else {
                    ui.window().hide();
                }
            });

            ui.fixallBtn().click(function () {
                ui.fixallBtn().hide();
                ui.clearfixedBtn().hide();
                ui.resetBtn().hide();

                var arr = [];

                for (var i = unresolvedIdx; i < problems.length; ++i) {
                    var promise = action.fixProblem(problems[i]);
                    promise.done(function (id) {
                        ++unresolvedIdx;

                        ui.setUnresolvedErrorNum(problems.length - unresolvedIdx);
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
                problems = [];
                analyzedIds = [];
                ui.setUnresolvedErrorNum(0);
                ui.setFixedErrorNum(0);
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
        }
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
