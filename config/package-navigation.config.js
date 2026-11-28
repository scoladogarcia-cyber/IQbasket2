/** A product is a perspective on shared modules, not a separate data store. */
const product=(id,routes)=>Object.freeze({id,titleKey:"packages."+id+".title",home:"package-"+id.toLowerCase(),routes:Object.freeze(routes)});
export const PACKAGE_NAVIGATION=Object.freeze([
 product("TEAMS",["team","players","games","lineups","advanced","heatmap","reports","training"]),
 product("COACHES",["training","players","games","advanced","heatmap","comparator","reports","ask"]),
 product("PLAYERS",["players","passport","nutrition","training","reports","player360"]),
 product("FAMILIES",["family","family-advisor","players","passport","nutrition","reports"])
]);
export const COMMON_NAV_KEYS=Object.freeze(["dashboard","approvals","business","profile","privacy","feedback","settings"]);
export const PACKAGE_HOME_ROUTES=Object.freeze(PACKAGE_NAVIGATION.map(p=>p.home));
