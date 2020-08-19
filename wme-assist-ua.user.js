// ==UserScript==
// @name         WME Assist UA
// @author       borman84 (Boris Molodenkov), madnut, turbopirate + (add yourself here)
// @description  Check and fix street names for POI and segments. UA fork of original WME Assist
// @require      https://rawgit.com/waze-ua/wme-assist-ua/master/scanner.js
// @require      https://rawgit.com/waze-ua/wme-assist-ua/master/analyzer.js
// @require      https://code.jquery.com/jquery-migrate-3.0.0.min.js
// @grant        none
// @include      /^https:\/\/(www|beta)\.waze\.com(\/\w{2,3}|\/\w{2,3}-\w{2,3}|\/\w{2,3}-\w{2,3}-\w{2,3})?\/editor\b/
// @version      2020.08.20.001
// ==/UserScript==

/* global $ */
/* global jQuery */
/* global map */
/* global require */

var WME_Assist = window.WME_Assist;

WME_Assist.debug = function (message) {
    if (!$('#assist_debug').is(':checked')) return;
    console.log("WME ASSIST DEBUG: " + message);
};

WME_Assist.info = function (message) {
    console.log("WME ASSIST INFO: " + message);
};

WME_Assist.warning = function (message) {
    console.log("WME ASSIST WARN: " + message);
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

    //var debug = WME_Assist.debug;
    var info = WME_Assist.info;
    //var warning = WME_Assist.warning;

    function getWazeApi() {
        var wazeapi = window.W;

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

    var ExperimentalRule = function (comment, func) {
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

        var rules_basicRU = function () {
            return rules_basicCommon().concat([
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/улицаица/, 'улица');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/скя( |$)/, 'ская$1'); // Волгостроевскя набережная
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/олодеж/, 'олодёж'); // Молодёжная
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(мая)( |$)/, '$1Мая$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(мкрн?\.?|мк?р?-н)( |$)/, '$1микрорайон$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(р-о?н)( |$)/, '$1район$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(им\.?)( |$)/, '$1имени$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пос\.?)( |$)/i, '$1посёлок$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(д\.?)( |$)/, '$1деревня$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(просп\.?)( |$)/i, '$1проспект$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(ул\.?)( |$)/i, '$1улица$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(р-д)( |$)/i, '$1разъезд$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(з-д)( |$)/i, '$1заезд$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пер\.?)( |$)/i, '$1переулок$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пр\.?|пр?-з?д\.?)( |$)/i, '$1проезд$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пр?-к?т\.?)( |$)/i, '$1проспект$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(тр-т)( |$)/i, '$1тракт$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(пл\.?)( |$)/i, '$1площадь$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(ш\.?)( |$)/, '$1шоссе$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(б-р|бул\.?)( |$)/i, '$1бульвар$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(дор\.)( |$)/i, '$1дорога$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(о\.?)( |$)/, '$1остров$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(наб\.?)( |$)/i, '$1набережная$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(туп\.?)( |$)/i, '$1тупик$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(кв\.?)( |$)/i, '$1квартал$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(^| )(набережная р\.?)( |$)/i, '$1набережная реки$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/^На /, 'на ');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(-ая)( |$)/, '$1-я$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(-ого|-ое)( |$)/, '$1$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(-[оыи]й)( |$)/, '$1-й$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(-ти)( |$)/, '$1-и$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)й/, '$1-й');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)я/, '$1-я');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(\d)(\sЛет)(\s|$)/, '$1 лет$3');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/(№)(\d)/, '$1 $2')
                        .replace(/(Проектируемый проезд)\s+(\d+[A-Я]?)/, '$1 № $2');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/([а-яё])-\s+/, '$1 - ');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/\s+км\./i, ' км');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/\[([^P]+)\]/, '$1');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/^СНТ\s(.*)/, '$1 снт');
                }),
                new Rule('Incorrect street name', function (text) {
                    return text.replace(/^ЖД$/i, 'ж/д');
                }),
                new Rule('Incorrect highway name', function (text) {
                    return text.replace(/^M-?(\d)/, 'М$1')
                        .replace(/^A-?(\d)/, 'А$1')
                        .replace(/^P-?(\d)/, 'Р$1')
                        .replace(/^([МАР])-(\d)/, '$1$2')
                        .replace(/^(\d{2})A-(\d)/, '$1А-$2')
                        .replace(/^(\d{2})K-(\d)/, '$1К-$2')
                        .replace(/^(\d{2})H-(\d)/, '$1Н-$2')
                        .replace(/^(\d{2})P-(\d)/, '$1Р-$2')
                        .replace(/^(\d+)А(:|\s+|$)/, '$1A$2')
                        .replace(/^(\d+)В(:|\s+|$)/, '$1B$2');
                }),
            ]);
        };

        var rules_RU = function () {
            return rules_basicRU().concat([
                new Rule('Incorrect status position', function (text) {
                    // Неоднозначные улицы, требуется проверка на город
                    // Москва: Козлова, Мишина
                    // Питер: Абросимова, Гусева, Комарова, Панфилова, Тарасова, Старцева, Крюкова, Миронова, Перфильева, Шарова, Зеленина
                    // Великий Новгород: Яковлева, Ильина
                    // Краткие притяжательные прилагательные похожие на фамилии
                    var exAdjW = 'Репищева|Малая Зеленина|Карташихина|Опочинина|Остоумова|Гаврикова|Прасковьина|Усачёва|Бармалеева|Ильмянинова|Остоумова|Плуталова|Подрезова|Полозова|Рашетова|Сегалева|Шамшева|Эсперова|Замшина|Куракина|Ольгина|Опочинина|Осокина|Рюхина|Тосина|Веткина|Жукова|Абросимова';

                    // Женские статусы
                    var wStatus = 'улица|набережная|дорога|линия|аллея|площадь|просека|автодорога|эстакада|магистраль|дамба|хорда|коса|деревня|переправа|площадка|дорожка|трасса';

                    // Мужские статусы
                    var mStatus = 'проспект|переулок|проезд|тупик|бульвар|тракт|просек|взвоз|спуск|разъезд|переезд|квартал|путепровод|мост|сад|сквер|тоннель|туннель|парк|проток|канал|остров|микрорайон|район|городок|посёлок|поселок|вал|проулок';

                    // Средние статусы
                    var nStatus = 'шоссе|кольцо';

                    // Не нужно добавлять статус или изменять порядок слов
                    var exStatus = 'лестница|зимник|объезд|заезд|съезд|обвод|обход|подъезд|дцать\\s|десят\\s|сорок\\s|closed|^\\d+(:|$)|[Дд]убл[её]р|\\d+[AB]|[МАР]\\d|\\d{2}[АКНР]-|Rail|грунтовка|[Тт]ропа|[Тт]рек|[Пп]лотина|метро|монорельс|ворота|шлагбаум|трамвай|пути$|Транссиб|Мост|подход|подъезд|обход|въезд|выезд|разворот|шлагбаум|слобода|Грейдер|брод|(?: |^)на |(?: |^)в |(?: |^)к |(?: |^)под |(?: |^)с |(?: |^)от |(?: |^)во |(?: |^)из |(?: |^)по |(?: |^)об |(?: |^)у |(?: |^)о |(?: |^)над |(?: |^)около |(?: |^)при |(?: |^)перед |(?: |^)про |(?: |^)до |(?: |^)без |(?: |^)за |(?: |^)через |ж\\/д|ТТК|КАД|ЗСД|АГ?ЗС|^$| - |\\/|,|плотина|снт|станция|:|[Пп]ромзона|паркинг|парковка|Козлова|Абросимова|Гусева|Комарова|Панфилова|Тарасова|Яковлева|Мишина|Старцева|Крюкова|Ильина|Миронова|Перфильева|Шарова|Зеленина|Жукова';

                    // Названия улиц похожие на прилагательные
                    var exW = 'Нехая|Тукая|Мая|Барклая|Батырая|Маклая|Бикбая|Амантая|Нечая|Эшпая|Орая|Прикамья|Алтая|Ухсая|Хузангая|Галлая|Николая|Гая|Эркая|Камая|Пченушая|Здоровья|Палантая|Ярвенпяя|Гулая|Заполярья|Крылья|Приморья|Калина Красная|Краснолесья|Мазая';

                    // Названия проспектов похожие на прилагательные
                    var exM = 'Расковой|Дуровой|Космодемьянской|.+?строй|Ковалевской|Борисовой|Давлетшиной|Крупской|Шевцовой|Чайкиной|Богомоловой|Савиной|Попковой|Петровой|Ангелиной|Терешковой|Новоселовой|Красноармейской|Гризодубовой|Красноярский рабочий|Цеткин|Молдагуловой|Чайкиной|Цветаевой|Тимофеевой|Дубровиной|Ульяны Громовой|[Нн]абережной|Давлетшиной|Перовской|Шпаковой|Ульяновой|Гачхой|Исаевой|Бой|Плевицкой';

                    // Отделить примечания в скобках (дублёр)
                    var brackets = '';
                    text = text.replace(/\s*(.*?)\s*(\(.*\))/,
                                        function (all, s, b) {
                        brackets = b;
                        return s;
                    });

                    // Игнорируем исключения
                    if ( new RegExp(exStatus).test(text) ) return text + ' ' + brackets;

                    // коттеджный, дачный, клубный посёлок в начало
                    text = text.replace(/(.*?)(?:\s+)((?:.*ый )посёлок)/, '$2 $1');

                    // Добавляем пропущенный статус
                    if ( ! new RegExp('(^|\\s+)(' + wStatus + '|' + mStatus + '|' + nStatus + ')(\\s+|$)').test(text) ) {
                        if ( text == 'Набережная') {
                            text = 'Набережная улица';
                        } else
                            if ( new RegExp('(^|\\s+)(' + wStatus + '|' + mStatus + '|' + nStatus + ')(\\s+|$)', 'i' ).test(text) ) {
                                // Если статус есть, но записан с заглавной буквы
                                text = text.replace( new RegExp('(^|\\s+)(' + wStatus + '|' + mStatus + '|' + nStatus + ')(?=\\s+|$)', 'i' ), function (all, space, status) {
                                    return space + status.toLowerCase();
                                });
                            } else
                                if ( /(^|\s+)[Оо]б[ъь]ездная(\s+|$)/.test(text)) {
                                    text = text.replace(new RegExp('(^|\\s+)[Оо]б[ъь]ездная(\\s+|$)(?!=(' + wStatus + '))'), '$1Объездная дорога$2');
                                } else
                                    if ( /(^|\s+)[Оо]кружная$/.test(text)) {
                                        text = text.replace(/(^|\s+)[Оо]кружная$/, '$1Окружная дорога');
                                    } else
                                        if ( /[-аяь]я$/.test(text)) { // Прилагательное без статуса (Русско-Полянская)
                                            text = text + ' улица';
                                        } else
                                            if (/[а-я]-[А-Я]/.test(text)) { // Не хватает пробелов вокруг тире (Москва-Петушки)
                                                text = text.replace(/([а-я])-([А-Я])/g, '$1 - $2');
                                            } else {
                                                text = 'улица ' + text;
                                            }
                    }

                    // Голые числительные без склонения
                    if ( ! new RegExp('\\d\\s+мая(\\s|$)', 'i' ).test(text) ) {
                        text = text.replace(new RegExp('(\\d)(?=(\\s+[^\\s]+(?:-я|ая|ья|яя|яся))*\\s+(' + wStatus + ')(\\s|$))', 'g'), '$1-я'); // 1 линия
                    }
                    text = text.replace(new RegExp('(\\d)(?=(\\s+[^\\s]+[-иоы]й|ин|[оеё]в)*\\s+(' + mStatus + ')(\\s|$))', 'g'), '$1-й'); // 2 проезд, 5 Донской проезд

                    // Распространённые сокращения
                    text = text.replace(/М\.\s+(?=Горького)/, 'Максима ');
                    text = text.replace(/К\.\s+(?=Маркса|Либкнехта)/, 'Карла ');
                    text = text.replace(/Р\.\s+(?=Люксембург)/, 'Розы ');
                    text = text.replace(/А\.\s+(?=Невского)/, 'Александра ');
                    text = text.replace(/Б\.\s+(?=Хмельницкого)/, 'Богдана ');

                    // Всё пишем заглавными буквами, кроме статусов, предлогов и гидронимов
                    text = text.replace(/(^|\s+)набережная улица/, '$1Набережная улица');
                    var foundStatus = false;
                    text = (' ' + text).replace(/([-\s])([^-\s]+)/g,
                                                function(all, space, word) {
                        if ( ! foundStatus ) {
                            if ( new RegExp('^(' + wStatus+ '|' + mStatus + '|' + nStatus + ')$').test(word) ) {
                                foundStatus = true;
                                return all;
                            }
                        }
                        if ( /^(летия|лет|года|реч?к[аи]|канала?|острова?|стороны|год|съезда|имени|ручей|канавки|за|из|от|км|километр|де|в|к|о|с|у|на|и)$/i.test(word) ||
                            ( space == '-' && /^(лейтенанта|майора|полковника|й|я|ти|го|е|ей|х)$/.test(word) ) ) {
                            return space + word.toLowerCase();
                        }
                        else return space + word.charAt(0).toUpperCase() + word.substr(1);
                    }).replace(/\s+(.*)/, '$1').replace(/Железная дорога/, 'железная дорога');

                    // Статусы женского рода
                    if ( new RegExp('(^|\\s)(' + wStatus + ')(\\s|$)').test(text) ) {

                        // Распространённые сокращения
                        text = text.replace(/М\.\s+(?=[^\s]+?(?:ая|ья|яя|яся)( |$))/, 'Малая ');
                        text = text.replace(/Б\.\s+(?=[^\s]+?(?:ая|ья|яя|яся)( |$))/, 'Большая ');

                        // перед статусом могут быть только прилагательные
                        // Строителей 1-я улица -> улица Строителей 1-я
                        text = text.replace(new RegExp('(?:\\s*)(.+?)(?:\\s+)(' + wStatus + ')(?=\\s+|$)'),
                                            function (all, adj, s) {
                            if ( new RegExp(exAdjW).test(adj) ) return all;
                            if ( (! new RegExp(exW).test(adj)) &&
                                (/^((\s+[^\s]+?(-я|ая|ья|яя|яся))+)$/.test(' ' + adj)) ) return all;
                            return s + ' ' + adj;
                        });

                        // Прилагательные вперёд
                        if ( ! new RegExp('(^|\\s|-)(' + exW + ')(-|\\s|$)').test(text) ) {
                            // улица Малая Зеленина -> Малая Зеленина улица
                            // улица Мягкая -> Мягкая улица
                            // улица Авиаконструктора Яковлева, улица Малиновая Гора
                            text = text.replace(new RegExp('(' + wStatus + ')((?:\\s+(?:' + exAdjW + ')|\\s+[^\\s]+(?:-я|ая|ья|яя|яся))+)$'), '$2 $1');
                            // улица *** Малая Набережная -> Малая Набережная улица ***
                            text = text.replace(new RegExp('(' + wStatus + ')(.*?)((?:\\s+[^\\s]+(?:-я|ая|ья|яя|яся))+)$'), '$3 $1$2');
                            // улица Мягкая 1-й Проезд -> Мягкая улица 1-й Проезд
                            text = text.replace(new RegExp('(' + wStatus + ')(?:\\s+)([^\\s]+(?:-я|ая|ья|яя|яся))(?=\\s+\\d+-й\\s+Проезд|\\s+\\d+-я\\s+Линия)'), '$2 $1');
                        }

                        // Числительное всегда вначале если оно согласовано с прилагательным
                        // Мягкая 1-я -> 1-я Мягкая
                        text = text.replace(/(.+(?:ая|ья|яя|яся))(?:\s+)(\d+-я)(?! Линия| Ферма| Рота)/, '$2 $1');
                        // улица 1-я Строителей -> 1-я улица Строителей
                        text = text.replace(new RegExp('(' + wStatus + ')(?:\\s+)(\\d+-я)(?!\\s+[^\\s]+(?:ая|ья|яя|яся|ка)( |$)|\\s+(' + wStatus + '|Ферма|Авеню|Пристань|Рота|Слобода))', 'i'), '$2 $1');
                        // 1-я улица Лесоперевалка -> улица 1-я Лесоперевалка
                        text = text.replace(new RegExp('(\\d+-я)\\s+(' + wStatus + ')\\s+([^\\s]+(?:лка|ель|аза))$'), '$2 $1 $3');
                    } else

                        // Статусы мужского рода
                        if ( new RegExp('(^|\\s)(' + mStatus + ')(\\s|$)').test(text) ) {

                            // Распространённые сокращения
                            text = text.replace(/М\.\s+(?=[^\s]+?(?:[-иоы]й|ин|[оеё]в)( |$))/, 'Малый ');
                            text = text.replace(/Б\.\s+(?=[^\s]+?(?:[-иоы]й|ин|[оеё]в)( |$))/, 'Большой ');

                            // перед статусом могут быть только прилагательные
                            text = text.replace(new RegExp('(?:\\s*)(.+?)(?:\\s+)(' + mStatus + ')(?=\\s+|$)'),
                                                function (all, adj, s){
                                // if ( /[а-яё]+([-иоы]й|ин)(\s+|$)/.test(adj) ) return all;
                                if ( (! new RegExp(exM, 'i').test(adj)) &&
                                    (/^((\s+[^\s]+?([-иоы]й|ин|[оеё]в))+)$/.test(' ' + adj)) ) return all;
                                return s + ' ' + adj;
                            });

                            // Прилагательное вперёд
                            if (( ! new RegExp('(^|\\s)(' + exM + ')(\\s|$)', 'i').test(text) ) &&
                                ( ! new RegExp('^(проезд|переулок)([^\.]*?)((?:\\s+[^\\s]+ой)+)$').test(text) ) ) {
                                // переулок *** 1-й -> 1-й переулок ***
                                text = text.replace(new RegExp('^(' + mStatus + ')([^\.]*?)((?:\\s+[^\\s]+(?:[-иоы]й|ин))+)$'), '$3 $1$2');
                                text = text.replace(
                                    new RegExp('^(' + mStatus + ')((?:\\s+[^\\s]+(?:[-иоы]й|ин))+)$'), '$2 $1');
                                text = text.replace(
                                    new RegExp('^(' + mStatus + ')(?:\\s+)([^\\s]+(?:[-иоы]й|ин))(?=\\s+\\d+-й\\s+Проезд|\\s+\\d+-я\\s+Линия)'), '$2 $1');
                            }

                            // Числительное всегда вначале если оно согласовано с прилагательным
                            // переулок 1-й Дунаевского  -> 1-й переулок Дунаевского
                            //text = text.replace(new RegExp('(' + mStatus + ')(?:\\s+)(\\d+-й)(?!\\s+[^\\s]*(?:' + exM + ')|\\s+[^\\s]+(?:[-иоы]й|ин|[оеё]в)( |$)', 'i'), '$2 $1');

                            text = text.replace(/(.+[иоы]й)(?:\s+)(\d+-й)/, '$2 $1');
                            text = text.replace(new RegExp('(' + mStatus + ')(?:\\s+)(\\d+-й)(?!\\s+[^\\s]+[иоык][ий]( |$)|\\s+(' + mStatus + '|Ряд|км))', 'i'), '$2 $1');
                        } else

                            // Статусы среднего рода
                            if ( new RegExp('(^|\\s)(' + nStatus + ')(\\s|$)').test(text) ) {

                                // Энтузиастов шоссе -> шоссе Энтузиастов
                                text = text.replace(new RegExp('(?:\\s*)(.+?)(?:\\s+)(' + nStatus + ')(?=\\s+|$)'),
                                                    function (all, adj, s){
                                    if ( /[а-яё]+(ое)(\s+|$)/.test(adj) ) return all;
                                    return s + ' ' + adj;
                                });

                                // шоссе Воткинское -> Воткинское шоссе, Верхнее шоссе
                                text = text.replace( new RegExp('^(' + nStatus + ')(?:\\s+)(.+[ео]е)$'), '$2 $1');
                            }

                    // Возвращаем скобки в конце
                    return text + ' ' + brackets;
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
            };

            var isPseudoStatus = function (str) {
                var list = ['шоссе', 'тракт', 'площадь', 'шаша', 'плошча', 'спуск'];
                if (list.indexOf(str) > -1) return true;
                return false;
            };

            var isNumber = function (str) {
                return /([0-9])-[іыйя]/.test(str);
            };

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
            };

            return rules_basicRU().concat([
                new Rule('Delete space in initials', function (text) {
                    return text.replace(/(^|\s+)([А-Я]\.)\s([А-Я]\.)/, '$1$2$3');
                }),
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
        };

        var rules_UA = function () {
            var hasCyrillic = function(s) {return s.search(/[а-яіїєґ]/i) != -1;};
            var hasShortStatus = function(s) { return s.search(/( |^)(вул\.|просп\.|мкрн\.|наб\.|пров\.|ст\.|пр\.|б-р|р-н)( |$)/i) != -1; };
            var hasLongStatus = function(s) { return s.search(/( |^)(площа|алея|шосе|тракт|узвіз|тупик|міст|в\'їзд|виїзд|виїзд|розворот|трамвай|залізниця|майдан|заїзд|траса|дорог[аи]|шляхопровід|шлях|завулок|квартал|автомагістраль)( |$)/i) != -1; };
            var hasSpecialStatus = function(s) { return s.search(/( |^)([РНТМ](-[0-9]+)+|[EОС][0-9]+)|~|>|\/( |$)|^(|до|на|>) /i) != -1; };
            var hasInternationalName = function(s) {return s.search(/^E[0-9]+$/i) != -1; };
            var hasStatus = function(s) { return (hasShortStatus(s) || hasLongStatus(s) || hasSpecialStatus(s)); };

            var hasAdjName = function(s) { return s.search(/( |^)(Балтійська|Кропивницька|Бориславська|Овочева|Спортивна|Дорогобицька|Зарічна|Привокзальна|Клубна|Запречистська|Заставська|Глибока|Японська|Київська|Городоцька|Зелена|Судова|Замкнена|Стрийська|Козельницька|Снопківська|Волоська|Турецька|Скельна|Грецька|Кубанська|Кримська|Водогінна|Аральська|Студентська|Переяславська|Дунайська|Дністерська|Тернопільська|Зубрівська|Сихівська|Райдужна|Вулецька|Соняшникова|Коломийська|Садибна|Демнянська|Наукова|Жасминова|Білоцерківська|Орлина|Кульпарківська|Вітряна|Молдавська|Виноградна|Холодноярська|Керамічна|Кишинівська|Львівська|Урожайна|Садова|Гіпсова|Окружна|Зв\'язкова|Житомирська|Повстанська|Збиральна|Авіаційна|Кондукторська|Полева|Дублянська|Вокзальна|Галицька|Любінська|Спокійна|Народна|Залізнична|Личаківська|Сполучна|Тернова|Конюшинна|Яворівська|Західна|Суховольська|Світла|Озерна|Ряшівська|Коротка|Сосновська|Весняна|Січова|Вузька|Журавлина|Рудненська|Чернівецька|Стародубська|Хотинська|Одеська|Стрілецька|Замарстинівська|Топольна|Інструментальна|Господарська|Волошкова|Сріблиста|Торф\'яна|Городницька|Сінна|Покутська|Заповітна|Малинова|Вербова|Перекопська|Квітова|Корінна|Східна|Крута|Реміснича|Узбецька|Технічна|Половинна|Хімічна|Жовківська|Лемківська|Сорочинська|Джерельна|Батуринська|Замкова|Клепарівська|Смерекова|Золота|Чорноморська|Вугільна|Сянська|Мулярська|Весела|Мукачівська|Ужгородська|Пильникарська|Базарна|Водна|Вагова|Таманська|Театральна|Вірменська|Університетська|Вічева|Руська|Друкарська|Сербська|Ставропігійська|Стара|Насипна|Рівна|Шевська|Староєврейська|Архівна|Підвальна|Валова|Гуцульська|Банківська|Пекарська|Севастопольська|Тиха|Лісна|Слободна|Харківська|Мала|Круп\'ярська|Таджицька|Кутова|Грибова|Ярова|Букова|Ромоданівська|Зимова|Долішня|Яричівська|Копальна|Казахська|Низова|Міжгірна|Грушева|Ялтинська|Чумацька|Богданівська|Глиняна|Переможна|Поетична|Приязна|Визвольна|Бігова|Наступальна|Пластова|Польова|Ковельська|Врізана|Ігорева|Корейська|Теребовлянська|Черкаська|Белзька|Молочна|Корецька|Крайня|Милятинська|Горіхова|Юнацька|Трависта|Бродівська|Старознесенська|Почаївська|Пинська|Миргородська|Поворотна|Потелицька|Новознесеньська|Волинська|Промислова|Опришківська|Механічна|Донецька|Льняна|Полтв\'яна|Селянська|Космічна|Купальська|Кукурудзяна|Бузька|Тарасівська|Бескидська|Лазнева|Підмурна|Рибна|Тролейбусна|Північна|Лугова|Лісова|Сигнальна|Таллінська|Ливарна|Левандівська|Повітряна|Тісна|Кочегарська|Естонська|Олешківська|Ясна|Щекавицька|Алмазна|Слюсарська|Папоротна|Ботанічна|Заболотівська|Мирна|Скромна|Пропелерна|Загородня|Моторна|Широка|Холмська|Лисеницька|Довга|Пасічна|Хлібна|Китайська|Садівнича|Каштанова|Медова|Околична|Відкрита|Бойківська|Куликівська|Червона|Мила|Сарненська|Природна|Перемиська|Моршинська|Конотопська|Похила|Художня|Вишнева|Молодіжна|Дивізійна|Поштова|Тунельна|Білоруська|Яблунева|Творча|Пільна|Шпитальна|Винниківська|Поліська|Загірна|Нагірна|Мурована|Нова|Архітекторська|Грюнвальдська|Політехнічна|Професорська|Бібліотечна|Болгарська|Випасова|Малоголосківська|Монгольська|Скісна|Резедова|Простинна|Бузинова|Порічкова|Осикова|Нарцисова|Розлога|Ряснянська|Паралельна|Південна|Комарнівська|Перемишльська|Заводська|Соборна|Тупікова|Горішня|Шкільна|Українська|Сонячна|Артищівська|Паркова|Равська|Старомостівська|Головна|Травнева|Клюсовська|Сокальська|Крива|Святоюрська|Завадівська|Центральна|Жовтнева|Колгоспна|Больнична|Радянська|Ювілейна|Степова|Порохова|Робітнича|Очеретяна|Жнивна|Буковинська|Луганська|Абхазька|Лижв\'ярська|Гайдамацька|Грабова|Полунична|Томашівська|Каховська|Гіацинтова|Дальня|Дозвільна|Лютнева|Корсунська|Підгаєцька|Дубнівська|Дрогобицька|Мисливська|Бакінська|Чуваська|Скнилівська|Щирецька|Санітарна|Лікувальна|Баштанна|Мостова|Паровозна|Вагонна|Проста|Суха|Фабрична|Солов\'[яї]на|Хорватська|Вільна|Затишна|Крехівська|Сходова|Спадиста|Туркменська|Олійна|Рослинна|Албанська|Азовська|Карпатська|Листопадна|Віденська|Енергетична|Соколина|Латвійська|Земельна|Трускавецька|Росиста|Рядова|Сусідня|Рахівська|Розбіжна|Рівнинна|Керченська|Піскова|Ніжинська|Кошова|Козацька|Гранітна|Дубова|Полуднева|Лебедина|Навколишня|Січнева|Горівська|Поморянська|Кінцева|Курінна|Новознесенська|Міртова|Шполянська)( |$)/i) != -1; };

            // ATTENTION: Rule order is important!
            return rules_basicCommon().concat([
                new Rule('Fix English characters in name', function (t) {
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
                    return text.replace(/(^| +)([А-ЯІЇЄҐ]\.) ([А-ЯІЇЄҐ]\.)/, '$1$2$3');
                }),
                new Rule('Incorrect characters in street name', function (t) {
                    // This rule should be before renaming rules or they couldn't see some errors
                    return t
                        .replace(/[@#№$,^!:;*"?<]/g, ' ').replace(/ {2,}/, ' ')
                        .replace(/[`’]/g, '\'');
                }),
                new Rule('Incorrect language', function (t) {
                    // Translate full Russian names to full Ukrainian
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
                        .replace(/(^| )набережна( |$)/i, '$1наб.$2');
                }),
                new Rule('Shorten street name or status must be long', function (t) {
                    return t
                        .replace(/(^| )туп\.?( |$)/i, '$1тупик$2')
                        .replace(/(^| )тр-т\.?( |$)/i, '$1тракт$2')
                        .replace(/(^| )(сп\.?|узв\.?|узвоз)( |$)/i, '$1узвіз$3')
                        .replace(/(^| )пл\.?( |$)/i, '$1площа$2')
                        .replace(/(^| )ал\.?( |$)/i, '$1алея$2')
                        .replace(/(^| )ш\.?( |$)/i, '$1шосе$2')
                        .replace(/(^|а )дор\.?( |$)/i, '$1дорога$2')
                        .replace(/(ї )дор\.?( |$)/i, '$1дороги$2')
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

                new Rule('Detect status absense or incorrect placement', function (t) {
                    return hasStatus(t) ? (hasAdjName(t) ? t.replace(/(.*)(вул\.)(.*)/, '$1 $3 $2') : t) : (hasAdjName(t) ? t + ' вул.' : '');
                }, 'Lviv'),

                new Rule('Move status to begin of name', function (text) {
                    if (!hasSpecialStatus(text)) {
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
                case 'Russia':
                    countryRules = rules_RU();
                    break;
                case 'Belarus':
                    countryRules = rules_BY();
                    break;
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

    var ActionHelper = function (wazeapi) {
        var WazeActionAddAlternateStreet = require("Waze/Action/AddAlternateStreet");
        var WazeActionUpdateFeatureAddress = require("Waze/Action/UpdateFeatureAddress");
        var WazeActionUpdateObject = require("Waze/Action/UpdateObject");

        var ui;

        var type2repo = function (type) {
            var map = {
                'venue': wazeapi.model.venues,
                'segment': wazeapi.model.segments
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

                var obj = type2repo(type).getObjectById(id);

                wazeapi.model.events.unregister('mergeend', map, select);

                if (obj) {
                    wazeapi.selectionManager.setSelectedModels([obj]);
                } else if (--attemptNum > 0) {
                    wazeapi.model.events.register('mergeend', map, select);
                }

                WME_Assist.debug("Attempt number left: " + attemptNum);

                wazeapi.map.setCenter(center, zoom);
            };

            return select;
        };

        this.isObjectVisible = function (obj) {
            if (!onlyVisible) return true;
            if (obj.geometry) {
                return wazeapi.map.getExtent().intersectsBounds(obj.geometry.getBounds());
            }
            return false;
        };

        var onlyVisible = false;

        this.fixProblem = function (problem) {
            var deferred = $.Deferred();
            var attemptNum = 10; // after that we decide that object was removed

            var fix = function () {
                var uniqueId = problem.object.id + '_' + problem.streetID;
                var obj = type2repo(problem.object.type).getObjectById(problem.object.id);
                wazeapi.model.events.unregister('mergeend', map, fix);

                if (obj) {
                    var addr = obj.getAddress().attributes;
                    var attr = {
                        countryID: addr.country.id,
                        stateID: addr.state.id,
                        cityName: addr.city.attributes.name,
                        emptyCity: addr.city.attributes.name === null || addr.city.attributes.name === '',
                        streetName: problem.newStreetName,
                        emptyStreet: problem.isEmpty
                    };
                    if (problem.attrName == 'streetIDs') {
                        // alternative names
                        if (obj.attributes.streetIDs.indexOf(problem.streetID) > -1) {
                            // remove old street
                            var streets2keep = [];
                            obj.attributes.streetIDs.forEach(function(sid) {
                                if (problem.streetID !== sid) {
                                    streets2keep.push(sid);
                                }
                            });
                            wazeapi.model.actionManager.add(new WazeActionUpdateObject(obj, { streetIDs: streets2keep}));

                            // add new street
                            wazeapi.model.actionManager.add(new WazeActionAddAlternateStreet(obj, attr, { streetIDField: problem.attrName }));
                        } else {
                            ui.updateProblem(uniqueId, '(not found. Deleted?)');
                        }
                    } else {
                        // protect user manual fix
                        if (problem.reason == addr.street.name) {
                            wazeapi.model.actionManager.add(new WazeActionUpdateFeatureAddress(obj, attr, { streetIDField: problem.attrName }));
                        } else {
                            ui.updateProblem(uniqueId, '(user fix: ' + addr.street.name + ')');
                        }
                    }
                    deferred.resolve(uniqueId);
                } else if (--attemptNum <= 0) {
                    ui.updateProblem(uniqueId, '(was not fixed. Deleted?)');
                    deferred.resolve(uniqueId);
                } else {
                    wazeapi.model.events.register('mergeend', map, fix);
                    wazeapi.map.setCenter(problem.detectPos, problem.zoom);
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
        section.innerHTML = '<b>Scanner Options</b><br/>' +
            '<label><input type="checkbox" id="assist_enabled" value="0"/> Enable/disable</label><br/>' +
            '<label><input type="checkbox" id="assist_skip_alt" value="0"/> Do not check alternative names</label><br/>' +
            '<label><input type="checkbox" id="assist_debug" value="0"/> Debug</label><br/>';
        var variant = document.createElement('p');
        variant.id = 'variant_options';
        // adopt city names for Ukraine
        if (countryName == 'Ukraine') {
            variant.innerHTML = '<b>Naming Rules</b><a href="https://wazeopedia.waze.com/wiki/Ukraine/Як_називати_вулиці" target="_blank"><span class="fa fa-question-circle"></span></a><br/>' +
                '<label><input type="radio" name="assist_variant" value="Ukraine" checked/> Ukraine (Classic)</label><br/>' +
                '<label><input type="radio" name="assist_variant" value="Lviv"/> 🦁 Lviv (Alternative)</label><br/>';
        } else {
            variant.innerHTML = '<b>Naming Rules</b><br/>' +
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
            .append($('<ul>').addClass('result-list').css({"height": "250px", "overflow": "auto"}));
        addon.appendChild(section);

        section = document.createElement('p');
        section.style.paddingTop = "8px";
        section.style.textIndent = "16px";
        section.id = "assist_exceptions";
        $(section)
            .append($('<p title="Right click on error in list to add">').addClass('message').css({'font-weight': 'bold'}).text('Exceptions'))
            .append($('<ul>').addClass('result-list').css({"height": "250px", "overflow": "auto"}));
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
                at: 'right-70 top+50',
                of: '#WazeMap'
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
                .append($('<div class="btn-toolbar">')
                    .append($('<button id="assist_fixall_btn" class="btn waze-btn waze-btn-small waze-btn-red">Fix all</button>'))
                    .append($('<button id="assist_fixselected_btn" class="btn waze-btn waze-btn-small waze-btn-red">Fix selected</button>'))
                    .append($('<button id="assist_scanarea_btn" class="btn waze-btn waze-btn-small waze-btn-blue">Scan area</button>'))
                    .append($('<button id="assist_clearfixed_btn" class="btn waze-btn waze-btn-small waze-btn-green">Clear fixed</button>'))
                    .append($('<button id="assist_clearall_btn" class="btn waze-btn waze-btn-small waze-btn-grey" title="Clear all results"><i class="fa fa-close"></i></button>')))
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
            .appendTo($('#WazeMap'));


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
            appendTo: $('#waze-map-container'),
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

        this.addProblem = function (id, text, selectFunc, editFunc, exception, experimental) {
            var problem = $('<li>')
            .prop('id', 'issue-' + id)
            .append($('<input>', {
                value: id,
                type: "checkbox"
            }))
            .append($('<a>', {
                href: "javascript:void(0)",
                text: text,
                click: function (event) {
                    selectFunc(event);
                },
                contextmenu: function (event) {
                    exception(event);
                    event.preventDefault();
                    event.stopPropagation();
                },
            }))
            .append('&nbsp;')
            .append($('<span>', {
                title: "Add custom rule for this problem",
                class: "fa fa-edit",
                style: "cursor: pointer;",
                click: function (event) {
                    editFunc(event);
                }
            }))
            .appendTo($('#assist_unresolved_list'));

            if (experimental) {
                problem.children().css({color: 'red'}).prop('title', 'Experimental rule');
            }
        };

        this.getCheckedItemsList = function () {
            var itemsList = [];
            $('#assist_unresolved_list').find('input').each(function () {
                if (this.checked) {
                    itemsList.push(this.value);
                }
            });
            return itemsList;
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
            $("#issue-" + escapeId(id)).appendTo($('#assist_fixed_list')).find("span").remove();
            $("#issue-" + escapeId(id)).find("input").remove();
        };

        this.removeError = function (id) {
            $("#issue-" + escapeId(id)).remove();
        };

        var fixAllBtn = $('#assist_fixall_btn');
        var fixSelectedBtn = $('#assist_fixselected_btn');
        var scanAreaBtn = $('#assist_scanarea_btn');
        var clearFixedBtn = $('#assist_clearfixed_btn');
        var clearAllBtn = $('#assist_clearall_btn');

        var unresolvedList = $('#assist_unresolved_list');
        var fixedList = $('#assist_fixed_list');

        var enableCheckbox = $('#assist_enabled');
        var skipAltCheckbox = $('#assist_skip_alt');
        var debugCheckbox = $('#assist_debug');

        var addCustomRuleBtn = $('#assist_add_custom_rule');
        var editCustomRuleBtn = $('#assist_edit_custom_rule');
        var delCustomRuleBtn = $('#assist_del_custom_rule');

        this.fixAllBtn = function () { return fixAllBtn; };
        this.fixSelectedBtn = function () { return fixSelectedBtn; };
        this.scanAreaBtn = function () { return scanAreaBtn; };
        this.clearFixedBtn = function () { return clearFixedBtn; };
        this.clearAllBtn = function () { return clearAllBtn; };

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

    var Application = function (wazeapi) {
        var scanner = new WME_Assist.Scanner(wazeapi);
        var analyzer = new WME_Assist.Analyzer(wazeapi);

        var FULL_ZOOM_LEVEL = 5;

        var scanForZoom = function (zoom) {
            scanner.scan(wazeapi.map.calculateBounds(), zoom, function (bounds, zoom, data) {
                WME_Assist.debug(data);

                //var w = window.open();
                //w.document.open();
                //w.document.write(JSON.stringify(data));
                //w.document.close();

                analyzer.analyze(bounds, zoom, data, function (id, obj, title, reason) {
                    ui.addProblem(id, title,
                        action.Select(obj.id, obj.type, obj.center, zoom),
                        function () {
                            ui.customRuleDialog('Add custom rule', {
                                oldname: '(.*)' + reason + '(.*)',
                                newname: reason
                            }).done(function (response) {
                                rules.push(response.oldname, response.newname);
                                ui.scanAreaBtn().click();
                            });
                        },
                        function () {
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
            scanForZoom(wazeapi.map.getZoom());
        };

        var countryName = function () {
            var id = wazeapi.model.countries.top.id;
            var name = wazeapi.model.countries.getObjectById(id).name;
            return name;
        };

        var country = countryName();

        var action = new ActionHelper(wazeapi);
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

        wazeapi.model.events.register('mergeend', map, function () {
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
                    wazeapi.model.events.register('mergeend', map, scan);
                } else {
                    localStorage.setItem('assist_enabled', false);
                    ui.hideMainWindow();

                    info('disabled');

                    wazeapi.model.events.unregister('mergeend', map, scan);
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

            ui.fixAllBtn().click(function () {
                ui.fixAllBtn().hide();
                ui.fixSelectedBtn().hide();
                ui.scanAreaBtn().hide();
                ui.clearFixedBtn().hide();
                ui.clearAllBtn().hide();

                wazeapi.model.events.unregister('mergeend', map, scan);

                setTimeout(function () {
                    analyzer.fixAll(function (id) {
                        ui.setUnresolvedErrorNum(analyzer.unresolvedErrorNum());
                        ui.setFixedErrorNum(analyzer.fixedErrorNum());
                        ui.moveToFixedList(id);
                    }, function () {
                        ui.fixAllBtn().show();
                        ui.fixSelectedBtn().show();
                        ui.scanAreaBtn().show();
                        ui.clearFixedBtn().show();
                        ui.clearAllBtn().show();

                        wazeapi.model.events.register('mergeend', map, scan);
                    });
                }, 0);
            });

            ui.fixSelectedBtn().click(function () {
                ui.fixAllBtn().hide();
                ui.fixSelectedBtn().hide();
                ui.scanAreaBtn().hide();
                ui.clearFixedBtn().hide();
                ui.clearAllBtn().hide();

                wazeapi.model.events.unregister('mergeend', map, scan);

                var listToFix = ui.getCheckedItemsList();

                setTimeout(function () {
                    analyzer.fixSelected(listToFix, function (id) {
                        ui.setUnresolvedErrorNum(analyzer.unresolvedErrorNum());
                        ui.setFixedErrorNum(analyzer.fixedErrorNum());
                        ui.moveToFixedList(id);
                    }, function () {
                        ui.fixAllBtn().show();
                        ui.fixSelectedBtn().show();
                        ui.scanAreaBtn().show();
                        ui.clearFixedBtn().show();
                        ui.clearAllBtn().show();

                        wazeapi.model.events.register('mergeend', map, scan);
                    });
                }, 0);
            });

            ui.clearFixedBtn().click(function () {
                ui.fixedList().empty();
            });

            ui.clearAllBtn().click(function () {
                ui.fixedList().empty();
                ui.unresolvedList().empty();

                analyzer.reset();

                ui.setUnresolvedErrorNum(0);
                ui.setFixedErrorNum(0);
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
    };

    function waitForWaze(done) {
        var wazeapi = getWazeApi();

        // Wait for Waze and jQuery.ui
        if (wazeapi === null || !jQuery.ui) {
            WME_Assist.info("waiting for Waze");
            setTimeout(function () {
                waitForWaze(done);
            }, 500);
            return;
        }

        done(wazeapi);
    }

    waitForWaze(function (wazeapi) {
        WME_Assist.info("Ready to work!");
        var app = new Application(wazeapi);
        app.start();
    });
}

run_wme_assist();
