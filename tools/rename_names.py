# Renames every Star Wars / SWG proper name the player can see. Internal ids (tatooine, naboo...) and SWG template paths stay,
# so saves, rules and data lookups keep working; planet display names come from PLANET_NAMES at runtime.
import re,sys,json
SRC=sys.argv[1]
h=open(SRC).read()
# ordered: longest / most specific first. Case-sensitive, whole words.
R=[
 ("Star Wars Galaxies","the old galaxy"),("Old Ben Kenobi's hut","Old Hermit's Hut"),("Temple of Exar Kun","Temple of the Fallen Lord"),("Exar Kun","the Fallen Lord"),
 ("Great Masassi Temple","Great Elder Temple"),("Sdungeon Rebel Outpost","Hidden Insurgent Outpost"),("Imp Hyperdrive Fac","Legion Drive Works"),("Imp Camp","Legion Camp"),
 ("Ancient Krayt Dragon Skeleton","Ancient Sand Wyrm Skeleton"),("Krayt Dragon","Sand Wyrm"),("Sarlacc Pit","Great Maw Pit"),("Lars Homestead","Mossrock Homestead"),
 ("Jabba's Palace","Bargo's Palace"),("Darklighter's Estate","Darkwater Estate"),("Amidala's Sandy Beach","the Queen's Sandy Beach"),("Rogue CorSec Base","Rogue Guard Base"),
 ("CorSec vs Flail Battle","Guard vs Flail Battle"),("CorSec","Coraxis Guard"),("Lok Nyms Stronghold","Scoria Nyx Stronghold"),("Downed Blood Razer Transport","Downed Blood Reaver Transport"),
 ("Singing Mountain","Chanting Peak"),("Hidden X Wing","Hidden Starfighter"),("X Wing","Starfighter"),("X-Wing","Starfighter"),("Echo Base","Frosthold Base"),
 ("Wampa Ice Caves","Frost Ape Caves"),("Wampa Matriarch","Frost Ape Matriarch"),("Wampas","Frost apes"),("Wampa","Frost Ape"),("Tauntaun hide","Snowstrider hide"),("Tauntaun","Snowstrider"),
 ("Teras Kasi","Iron Palm"),("Mos Eisley","Ashport"),("Mos Espa","Espa Hollow"),("Mos Entha","Enthara"),("Mos Taike","Taikor"),("Sand Crawler","Sandhauler"),("Sandcrawler","Sandhauler"),
 ("Kor Vella","Sorrowmere"),("Vreni Island","Vesk Isle"),("Doaba Guerfel","Dorvan Gulch"),("Bela Vistal","Brightvale"),("Deeja Peak","Deyla Peak"),("Rhoa Arod","Rhoan Ford"),("Agrilat Swap","Agrin Marsh"),
 ("Yavin 4","Verdance IV"),("Yavin IV","Verdance IV"),("Yavin4","Verdance IV"),
 # planets
 ("Tatooinian","Sarraki"),("Tatooine","Sarrak"),("Naboo","Veylara"),("Corellian","Coraxi"),("Corellia","Coraxis"),("Talusian","Talverni"),("Talus","Talvern"),("Rori","Rhosmire"),("Dantooine","Dawnreach"),
 ("Lokian","Scorian"),("Lok","Scoria"),("Yavinian","Verdant"),("Yavin","Verdance"),("Endorian","Eldermoon"),("Endor","Eldermoon"),("Dathomirian","Crimsonan"),("Dathomir","Crimsona"),
 ("Kashyyykian","Vashtari"),("Kashyyyk","Vashtar"),("Mustafarian","Pyraxian"),("Mustafar","Pyraxis"),("Hoth","Rimehold"),
 # towns and places
 ("Anchorhead","Anchorstead"),("Bestine","Bestrel"),("Wayfar","Wayfarer's Rest"),("Theed","Theran"),("Keren","Kestrel"),("Moenia","Moranth"),("Kaadara","Kadorra"),("Coronet","Crownhaven"),("Tyrena","Tyveth"),
 ("Restuss","Restavel"),("Dearic","Derrimoor"),("Nashal","Nashel Bay"),("Narmle","Narmoor"),("Denendre","Dendrel"),("Agrilat","Agrin"),("Yawari","Yawen"),("Dulok Villlage","Dunnok Village"),("Dulok","Dunnok"),
 ("Ewok","Furrow"),("Kimogila","Kragmaw"),("Nyms","Nyx"),("Nym","Nyx"),("Mokk","Morrok"),("Dantari","Dunari"),("Nightsisters","Duskwitches"),("Nightsister","Duskwitch"),("Sarlacc","Great Maw"),
 ("Gungans","Gorrans"),("Gungan","Gorran"),("Mordran","Mordhal"),("Garyn","Garran"),("Cobral","Coval"),("Kobala Spice Mine","Kobra Ore Mine"),("Kobala","Kobra"),("Durbin","Durvin"),("Aqualish","Aquari"),
 ("Krayt","Wyrm"),("Jawa","Scav"),("Jawas","Scavs"),("Tuskens","Dune Raiders"),("Tusken","Dune Raider"),("Darklighter","Darkwater"),("Jabba's","Bargo's"),("Jabba","Bargo"),("Kenobi","the Hermit"),
 ("Woolamander","Mandril"),("Massassi","Elder"),("Masassi","Elder"),("Jedi","Warden"),("Sith","Fallen"),("Imperials","Legionnaires"),("Imperial","Legion"),("Empire","Hegemony"),("Rebellion","Insurgency"),("Rebels","Insurgents"),("Rebel","Insurgent"),
 ("Stormtroopers","Legionnaires"),("Stormtrooper","Legionnaire"),("Wookiees","Vashtari"),("Wookiee","Vashtari"),("Hutts","Bargos"),("Hutt","Bargo"),("Rodian","Rhodar"),("Trandoshan","Trandor"),("Ithorian","Ithar"),
 ("Twi'lek","Lekari"),("Bothan","Vothan"),("Zabrak","Zarak"),("Sullustan","Sulvan"),("Mon Calamari","Calamar"),("Rancor","Rendmaw"),("Bantha","Grazhorn"),("Dewback","Sandback"),("Eopie","Dunestrider"),
 ("Nexu","Spinecat"),("Acklay","Scythebeast"),("Mynock","Hullbat"),("Kaadu","Swampstrider"),("Carbonite","Cryo-steel"),("Lightsaber","Lumen blade"),("Bacta","Medigel"),("Droids","Bots"),("Droid","Bot"),
]
# lower-case words that only ever appear in player-facing lore (never in templates or code ids)
LOWER=[("tauntauns","snowstriders"),("lightsaber","lumen blade"),("bacta","medigel")]
def sub_cap(text):
  for a,b in R:text=re.sub(r'(?<![A-Za-z])'+re.escape(a)+r'(?![a-z])',b,text)
  return text
# JSON data blocks: rename only string values of keys that are display text, never template paths ("t" unless travel), ids or keys
def fix_json(m):
  tag,body,end=m.group(1),m.group(2),m.group(3)
  def walk(o,key=None):
    if isinstance(o,dict):return {k:walk(v,k) for k,v in o.items()}
    if isinstance(o,list):return [walk(v,key) for v in o]
    if isinstance(o,str):
      if key=='t' and '/' in o:return o           # template paths drive the kit rules
      if key in ('id','k','cat','src','kind','race','faction') :return o
      return sub_cap(o)
    return o
  try:d=json.loads(body)
  except Exception:return m.group(0)
  return tag+json.dumps(walk(d),separators=(',',':'),ensure_ascii=False)+end
h=re.sub(r'(<script id="[a-z0-9]+" type="application/json">)(.*?)(</script>)',fix_json,h,flags=re.S)
# code and markup outside the data blocks: capitalised names only (ids and templates are lower case)
parts=re.split(r'(<script id="[a-z0-9]+" type="application/json">.*?</script>)',h,flags=re.S)
for i in range(0,len(parts),2):
  s=sub_cap(parts[i])
  for a,b in LOWER:s=re.sub(r'(?<![A-Za-z_\-/])'+a+r'(?![A-Za-z_\-])',b,s)
  # player-facing SWG mentions
  s=s.replace("A sandbox MMO on the real worlds of the old galaxy, rebuilt from SWGEmu Core3 and Holocore data.","A sandbox MMO across a living galaxy of worlds: survey, build, craft and fight your way across thirteen planets.")
  s=s.replace("buildings and statics from ProjectSWG Holocore buildouts, POIs, cities, travel points and spawns from SWGEmu Core3.","buildings, statics, points of interest, cities, travel points and spawns from open-source world data.")
  s=s.replace("World data: SWGEmu Core3 and ProjectSWG Holocore.","World layout: open-source emulator data (credited in the project README).")
  s=s.replace("As in SWG, earn the XP","Earn the XP").replace("Surrender boxes to free points, as in SWG.","Surrender boxes to free points.").replace("the real values from your SWG client's skills table","the classic skill-table values")
  parts[i]=s
h=''.join(parts)
open(SRC,'w').write(h)
print('done')
