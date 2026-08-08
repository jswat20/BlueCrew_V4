const organizationContactService = (() => {
  const PILOT_CONTACT = Object.freeze({ name: "John Switala", phone: "(410) 627-6250", email: "juniorumps@gmail.com" });
  let configuredContact = null;
  function normalize(source = {}) { return { name: String(source.name || "").trim(), phone: String(source.phone || source.phoneNumber || "").trim(), email: String(source.email || source.emailAddress || "").trim() }; }
  function configure(settings = {}, organization = {}) { const contact = normalize(settings.game_contact || settings.gameContact || {}); const lakeShore = /lake[ -]?shore/i.test(`${organization.name || ""} ${organization.slug || ""}`); configuredContact = contact.name || contact.phone || contact.email ? contact : lakeShore ? { ...PILOT_CONTACT } : null; return getGameContact(); }
  function clear() { configuredContact = null; }
  function getGameContact(game = {}) { const contact = normalize(game.gameDayContacts?.primaryContact || game.contact || {}); return contact.name || contact.phone || contact.email ? contact : configuredContact ? { ...configuredContact } : null; }
  return { configure, clear, getGameContact };
})();
