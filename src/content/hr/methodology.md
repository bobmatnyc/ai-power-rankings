---
title: "Metodologija Rangiranja"
subtitle: "Razumijevanje kako evaluiramo i rangiramo AI alate za kodiranje"
---

## Pregled Algoritma

### Algoritam v7.0: Dinamička Inteligencija Vijesti i Mogućnosti Alata

Naš algoritam rangiranja evaluira AI alate za kodiranje kroz sveobuhvatan okvir koji uzima u obzir multiple faktore, primjenjuje dinamičke modifikatore, integrira analizu vijesti u stvarnom vremenu za bodovanje brzine te poboljšava procjenu mogućnosti upravljanja potprocesima i alatima.

#### Ključne Značajke

- Dinamičko bodovanje brzine iz analize vijesti u stvarnom vremenu
- Poboljšana procjena mogućnosti potprocesa i alata
- Opadanje inovacije tijekom vremena (poluživot od 6 mjeseci)
- Kazne i bonusi za rizik platforme
- Prilagodbe kvalitete prihoda prema poslovnom modelu
- Pojačano vaganje tehničkih performansi
- Zahtjevi za validaciju podataka
- Logaritamsko skaliranje za tržišne metrike

## Faktori Ocjenjivanja

Naš okvir za evaluaciju uzima u obzir kako primarne tako i sekundarne faktore za pružanje holističke procjene sposobnosti i tržišne pozicije svakog alata.

### Primarni Faktori

#### 🤖 Agentska Sposobnost (30%)

Uređivanje više datoteka, planiranje zadataka, autonomno djelovanje, upravljanje potprocesima, podrška ekosustava alata

#### 💡 Inovacija (15%)

Vremenska ocjena inovacije s opadanjem, revolucionarne značajke

#### ⚡ Tehnička Performansa (12,5%)

SWE-bench rezultati s pojačanim vaganjem, podrška za više datoteka, kontekstni prozor, performanse potprocesa

#### 👥 Prihvaćanje Razvijatelja (12,5%)

GitHub zvjezdice, aktivni korisnici, angažman zajednice

#### 📈 Tržišna Privlačnost (12,5%)

Prihodi, rast korisnika, financiranje, procjena

### Sekundarni Faktori

#### 💬 Poslovni Sentiment (7,5%)

Tržišna percepcija, rizici platforme, konkurentska pozicija

#### 🚀 Brzina Razvoja (5%)

Dinamički zamah iz sentimenta vijesti, izdanja značajki, odgovora zajednice (30-dnevni prozor)

#### 🛡️ Otpornost Platforme (5%)

Podrška za više modela, neovisnost, opcije samo-hostiranja

## Okvir Ocjenjivanja Inovacije

Naše ocjenjivanje inovacije (15% ukupno) evaluira revolucionarne sposobnosti i promjene paradigme u AI alatima za kodiranje.

### Ključne Dimenzije Inovacije

#### 🤖 Arhitektura Autonomije (25%)

Sofisticiranost planiranja, neovisnost izvršavanja i sposobnosti učenja

**Skala:**

- Osnovno (1-3): Jednokoračno izvršavanje s ručnim vođenjem
- Napredno (4-6): Višekoračno planiranje s kontrolnim točkama
- Revolucionarno (7-10): Samonapredni autonomni sustavi

#### 🧠 Razumijevanje Konteksta (20%)

Razumijevanje baze koda, skala konteksta i multimodalna integracija

**Skala:**

- Razina datoteke (1-3): Razumijevanje jedne datoteke
- Razina projekta (4-6): Potpuno razumijevanje arhitekture
- Razina poslovanja (7-10): Razumijevanje namjere i logike

#### ⚡ Tehnične Sposobnosti (20%)

Inovacija AI modela, jedinstvene značajke i proboji performansi

**Skala:**

- Standard (1-3): Gotove implementacije
- Napredne (4-6): Prilagođeni modeli i orkestracija
- Proboj (7-10): Nove arhitekture i paradigme

#### 🔄 Transformacija Tijeka Rada (15%)

Inovacija procesa razvoja i modeli suradnje čovjek-AI

**Skala:**

- Poboljšanje (1-3): Poboljšava postojeće tijekove rada
- Inovacija (4-6): Omogućuje nove metodologije
- Revolucija (7-10): Fundamentalno mijenja razvoj

#### 🌐 Integracija Ekosustava (10%)

Inovacija protokola i strategija platforme

**Skala:**

- Standard (1-3): Tradicionalne integracije
- Stvaranje Protokola (4-6): Otvoreni standardi (MCP, A2A)
- Industrijsko Vodstvo (7-10): Široko usvajanje protokola

#### 📊 Utjecaj na Tržište (10%)

Inovacija kategorije i industrijski utjecaj

**Skala:**

- Sudionik (1-3): Natječe se u postojećim kategorijama
- Vođa Kategorije (4-6): Definira standarde kategorije
- Stvaratelj Kategorije (7-10): Stvara nove paradigme

### Skala Ocjenjivanja

| Rezultat | Opis                       |
| -------- | -------------------------- |
| 9-10     | Revolucionarni proboj      |
| 7-8      | Velika inovacija           |
| 5-6      | Značajan napredak          |
| 3-4      | Postupno poboljšanje       |
| 1-2      | Minimalna inovacija        |
| 0        | Nema inovacije             |

> **Napomena:** Rezultati inovacije se evaluiraju mjesečno i uzimaju u obzir kako apsolutnu inovaciju tako i relativni napredak unutar konkurentskog krajolika. Rezultati mogu opasti tijekom vremena kako inovacije postaju standardne značajke.

## Dinamički Modifikatori

Naš algoritam primjenjuje sofisticirane modifikatore za hvatanje tržišnih dinamika i osiguravanje da rangiranja odražavaju stvarne uvjete.

### 🔄 Opadanje Inovacije

Utjecaj inovacije opada tijekom vremena kako revolucionarne značajke postaju standard. Primjenjujemo eksponencijalno opadanje s poluživotom od 6 mjeseci.

```
score = originalScore * e^(-0.115 * monthsOld)
```

### ⚠️ Rizik Platforme

Prilagodbe temeljene na ovisnostima platforme i poslovnim rizicima.

#### Kazne

- Kupljen od LLM pružatelja: -2,0
- Ekskluzivna LLM ovisnost: -1,0
- Konkurent kontroliran: -1,5
- Regulatorni rizik: -0,5
- Financijska nevolja: -1,0

#### Bonusi

- Multi-LLM podrška: +0,5
- Spreman za open source LLM: +0,3
- Opcija samo-hostiranja: +0,3

### 💰 Kvaliteta Prihoda

Rezultati tržišne privlačnosti se prilagođavaju prema kvaliteti poslovnog modela.

| Poslovni Model              | Množitelj |
| --------------------------- | --------- |
| Enterprise High ACV (>100k€) | 100%      |
| Enterprise Standard (10k-100k€) | 80%       |
| SMB SaaS (<10k€)           | 60%       |
| Consumer Premium            | 50%       |
| Freemium                    | 30%       |
| Open Source/Donacije       | 20%       |

## Izvori Podataka & Validacija

### Metode Prikupljanja Podataka

- Službeni API-ji i dokumentacija
- Ekspertska evaluacija i istraživanje
- Javne objave i izdanja
- Povratne informacije zajednice i podaci o korištenju
- Rezultati benchmarka i metrike performansi

### Zahtjevi za Validaciju

- Minimum 80% potpunosti osnovnih metrika
- Prag pouzdanosti izvora od 60%
- Detekcija odstupanja za >50% mjesečnih promjena
- Unakrsna validacija s više izvora

### Učestalost Ažuriranja

Rangiranja se ažuriraju mjesečno, s kontinuiranim prikupljanjem podataka i validacijom tijekom svakog razdoblja.

## Dinamička Inteligencija Vijesti

### Bodovanje Brzine Temeljeno na Vijestima

Brzina razvoja sada se dinamički izračunava korištenjem sofisticirane analize vijesti koja prati zamah kroz više dimenzija.

#### Indikatori Zamaha
- Izdanja proizvoda i najave značajki
- Vijesti o partnerstvima i integracijama
- Tehnički proboji i mjerila
- Prihvaćanje zajednice i priče o uspjehu
- Priznanja industrije i nagrade

#### Bodovanje Sentimenta
- Pozitivan zamah: pojačanje od +3 do +5
- Snažan napredak: pojačanje od +1 do +3
- Neutralno/stabilno: 0 prilagodba
- Izazovi/neuspjesi: kazna od -1 do -3
- Kritični problemi: kazna od -3 do -5

### 30-dnevni Klizni Prozor

Bodovi brzine koriste 30-dnevni klizni prozor s eksponencijalnim opadanjem, dajući veću težinu nedavnim razvojima dok zadržavaju svijest o trendovima.

```
velocityScore = Σ(sentimentScore * e^(-λ * daysOld)) / 30
```

## Podrška za Potprocese i Alate

### Poboljšane Agentske Mogućnosti

Bodovanje agentskih mogućnosti sada uključuje sofisticirano evaluiranje orkestracije potprocesa i korištenja alata.

#### Upravljanje Potprocesima (40%)
- Mogućnosti multi-agentske orkestracije
- Sofisticiranost delegiranja zadataka
- Podrška za paralelno izvršavanje
- Prenos i integracija konteksta
- Rukovanje greškama i oporavak

#### Ekosustav Alata (60%)
- Dubina podrške nativnih alata
- Integracija alata trećih strana
- API-ji za stvaranje prilagođenih alata
- Otkrivanje i odabir alata
- Podrška protokola (MCP, itd.)

### Rubrika Bodovanja

| Razina Mogućnosti | Prilagodba Bodova |
|------------------|-------------------|
| Napredna multi-alatna orkestracija | +5,0 |
| Sofisticirano upravljanje potprocesima | +4,0 |
| Bogat ekosustav nativnih alata | +3,0 |
| Osnovna podrška alata | +1,0 |
| Ograničene/bez mogućnosti alata | 0,0 |

## Poboljšane Tehničke Performanse

### Interpretacija SWE-bench Rezultata

Bodovanje tehničkih performansi koristi nijansiranu interpretaciju SWE-bench rezultata s logaritamskim skaliranjem:

```
technicalScore = log(1 + sweBenchScore) * performanceMultiplier
```

### Multiplikatori Performansi

| Razina Performansi | Multiplikator |
|-------------------|---------------|
| Izniman (>90. percentil) | 1,5x |
| Snažan (75-90. percentil) | 1,3x |
| Dobar (50-75. percentil) | 1,1x |
| Prosječan (25-50. percentil) | 1,0x |
| Ispod prosjeka (<25. percentil) | 0,8x |