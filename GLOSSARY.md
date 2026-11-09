# Racespel

Dit contextmodel beschrijft de begrippen van een browser-racespel waarin je met hoge snelheid door wireframe-tunnels rijdt en ertussen springt.

## Parcours en beweging

**Tunnel**:
Een aaneengesloten, berijdbaar gedeelte van het parcours met een rechthoekige doorsnede. Een tunnel kan eindigen in een omhooglopende lanceerhelling.
_Avoid_: baanstuk, level (als synoniem voor tunnel)

**Sprong**:
De overgang door een opening van de ene tunnel naar een volgende, afzonderlijke tunnel, gestart door een omhooglopende lanceerhelling. De racer volgt een zwaartekrachtboog; onvoldoende vaart of het raken van de volgende tunnelwand, inclusief het dak, maakt de sprong ongeldig.
_Avoid_: jump (als aparte spelactie)

**Lanceerhelling**:
Het omhooglopende uiteinde van een tunnel dat de racer bij voldoende vaart de lucht in lanceert.
_Avoid_: automatische sprong (zonder helling)

**Sturen**:
De racer direct zijwaarts verplaatsen om bochtkrachten te corrigeren en binnen de tunnel en veilige landingszone te blijven. Contact met een tunnelrand kost vaart; een zware framebotsing beëindigt de poging.
_Avoid_: automatisch de bocht volgen

**Vaart**:
De snelheid waarmee de racer beweegt; die beïnvloedt zowel het snelheidsgevoel als de afstand die een sprong overbrugt. De racer kan een hoge topsnelheid bereiken, maar moet sturen om in bochten binnen de tunnel te blijven.
_Avoid_: snelheid (wanneer het specifiek om de spelwaarde gaat)

**Parcours**:
De opeenvolging van drie langere tunnelgedeelten met meerdere bochten, heuvels en dalen, verbonden door twee sprongen die de speler probeert te voltooien.
_Avoid_: track (als synoniem voor de volledige rit)

**Lanceersignaal**:
Een rood, oranje of groen visueel signaal dat op basis van de verwachte baan aangeeft of de racer de veilige landingszone niet, mogelijk of naar verwachting wel haalt.
_Avoid_: sprongvoorspelling

**Landingszone**:
Het ruime gebied binnen de volgende tunnel waarin de racer een sprong veilig kan beëindigen; het dak of een andere tunnelrand raken geldt als een mislukte landing.
_Avoid_: perfecte landing

**Checkpoint**:
Een bereikte tunnel waar de racer na een mislukte sprong of val opnieuw begint.
_Avoid_: respawnpunt (als andere spelterm)
