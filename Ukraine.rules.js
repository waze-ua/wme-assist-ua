Country.code = 'UA';
Country.version = '2017.09.23';
Country.variants = ['Ukraine', 'Lviv'];
Country.rules = function () {
    var hasCyrillic = function(s) {return s.search(/[а-яіїєґ]/i) != -1;};
    var hasShortStatus = function(s) { return s.search(/( |^)(вул\.|просп\.|мкрн\.|наб\.|пров\.|ст\.|пр\.|дор\.|б-р|р-н)( |$)/i) != -1; };
    var hasLongStatus = function(s) { return s.search(/( |^)(площа|алея|шосе|тракт|узвіз|тупик|міст|в\'їзд|виїзд|виїзд|розворот|трамвай|залізниця|майдан|заїзд|траса|шляхопровід|шлях|завулок|квартал)( |$)/i) != -1; };
    var hasSpecialStatus = function(s) { return s.search(/( |^)([РНТМ](-[0-9]+)+|[EОС][0-9]+)( |$)|^(|до|на|>) /i) != -1; };
    var hasInternationalName = function(s) {return s.search(/^E[0-9]+$/i) != -1; };
    var hasStatus = function(s) { return (hasShortStatus(s) || hasLongStatus(s) || hasSpecialStatus(s)); };

    // ATTENTION: Rule order is important!
    return [
        new Rule(function (t) { // Fix english characters in name
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
            new Rule(function (text) { // Delete space in initials
                return text.replace(/(^| +)([А-ЯІЇЄ]\.) ([А-ЯІЇЄ]\.)/, '$1$2$3');
            }),
            new Rule(function (t) { // Incorrect characters in street name
                // This rule should be before renaming rules or they couldn't see some errors
                return t
                    .replace(/[@#№$,^!:;*"?<]/, ' ').replace(/ {2,}/, ' ')
                    .replace(/[`’]/g, '\'');
            }),
            new Rule(function (t) { // Incorrect language
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
            new Rule(function (t) { // Mistake in short status
                return t
                    .replace(/(^| )(буль?в?\.?|б-р\.)( |$)/i, '$1б-р$3')
                    .replace(/(^| )(?:пр-к?т|п(?:р|о)?сп)\.?( |$)/i, '$1просп.$2')
                    .replace(/(^| )пр-з?д\.?( |$)/i, '$1пр.$2')
                    .replace(/(^| )ул\.?( |$)/i, '$1вул.$2')
                    .replace(/(^| )р-н\.( |$)/i, '$1р-н$2')
                    .replace(/(^| )пер\.?( |$)/i, '$1пров.$2')
                    .replace(/(^| )(пров|просп|пр|вул|ст|мкрн|наб|дор)( |$)/i, '$1$2.$3');
            }),
            new Rule(function (t) { // Long status must be short
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
            new Rule(function (t) { // Shorten street name or status must be long
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
            new Rule(function (t) { // Incorrect number ending
                return t
                    .replace(/-[гштм]а/, '-а')
                    .replace(/-[ыоиі]й/, '-й')
                    .replace(/-тя/, '-я')
                    .replace(/-ая/, '-а');
            }),
            new Rule(function (text) { // Incorrect highway name
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
            new Rule(function (text) { // Incorrect local street name
                return text.replace(/([ТтT])[-\s]*([0-9]{2})[-\s]*([0-9]{2})/, function (a, p1, p2, p3) {
                    p1 = p1
                        .replace('т', 'Т')
                        .replace('T', 'Т');

                    return p1 + '-' + p2 + '-' + p3;
                });
            }),
            new Rule(function (text) { // Incorrect international highway name
                return text.replace(/^ *[eе][- ]*([0-9]+)/i, 'E$1');
            }),
            new Rule(function (text) { // Incorrect local road name
                return text.replace(/([OoCcОоСс])[-\s]*([0-9]+)[-\s]*([0-9]+)[-\s]*([0-9]+)/, function (a, p1, p2, p3, p4) {
                    p1 = p1
                        .replace('o', 'О')
                        .replace('O', 'О')
                        .replace('c', 'С')
                        .replace('C', 'С');

                    return p1 + p2 + p3 + p4;
                });
            }),

            new Rule(function (t) { // Append status
                return hasStatus(t) ? t : 'вул. ' + t;
            }, 'Ukraine'),

            new Rule(function (text) { // Move status to begin of name
                var excludeList = /(?: |^)до |(?: |^)на /;
                if (! new RegExp(excludeList).test(text)) {
                    return text.replace(/(.*)(вул\.)(.*)/, '$2 $1 $3');
                }
                return text;
            }, 'Ukraine'),
        ];
 };
