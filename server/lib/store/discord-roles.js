/** Zelfde Discord-app als staff-portaal */
module.exports = {
  clientId: '1105558581304098867',
  /** Store-beheer: Founder, Co-Founder + store-beheer rol */
  beheerRoleIds: [
    '1502448623252930601',
    '1502448625366732971',
    '1502448726676078704',
  ],
  ranks: [
    { id: 'founder', naam: 'Founder', discordRoleId: '1502448623252930601' },
    { id: 'co-founder', naam: 'Co-Founder', discordRoleId: '1502448625366732971' },
    { id: 'beheer-team', naam: 'Beheer Team', discordRoleId: '1502448635709751457' },
    { id: 'bestuur-team', naam: 'Bestuur Team', discordRoleId: '1502448643041661088' },
    { id: 'hogerop-team', naam: 'Hogerop Team', discordRoleId: '1502448648930459792' },
    { id: 'staff', naam: 'Staff', discordRoleId: '1502448659839582230' },
  ],
};
