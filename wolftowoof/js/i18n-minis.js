/* Wolf to Woof - texts for the Play menu and its six mini-games. */
(function () {
    'use strict';
    window.WTW.i18n.add({
        en: {
            playTitle: 'Games', playSub: 'Pick a game, then a dog. Every dog has its own talents!',
            pickDogFor: 'Who plays?', needAdult: 'Only grown dogs can play.',
            playLocked: 'Raise your first pup to unlock the games.', unlockAt: 'Opens in chapter {n}',
            unlockScent: 'Unlocked: Scent Match!', unlockEyes: 'Unlocked: Night Eyes!', unlockHowl: 'Unlocked: Howl Chorus!',
            gPlay: 'Play {n} mini-games',
            // the six games
            pointTitle: 'Point!', wordsTitle: 'Word Genius', scentTitle: 'Scent Match', eyesTitle: 'Night Eyes', howlTitle: 'Howl Chorus',
            // what a dog's genes change in each game
            skillFetch: 'Tame dogs chase the stick more eagerly.',
            skillPoint: 'Tame dogs follow your point better. Wolves ignore it!',
            skillWords: 'Tame dogs learn names faster.',
            skillScent: 'A long snout smells better: more hints.',
            skillEyes: 'Upright ears hear danger first.',
            skillHowl: 'The wilder the dog, the longer the howl.',
            // "did you know" on the result card: the science behind each game
            factFetch: 'Some wolf pups bring back a thrown ball: fetch is older than dogs.',
            factPoint: 'Foxes bred only for tameness understood pointing as well as dogs. Wild foxes did not.',
            factWords: 'Chaser the border collie knew the names of 1,022 toys.',
            factScent: 'A dog’s nose has hundreds of millions of scent receptors. Ours has a few million.',
            factEyes: 'Pupil shape gives animals away: vertical slits hunt from ambush, horizontal bars graze.',
            factHowl: 'Wolves howl on different notes, so a small pack sounds like a big one.',
            // Point!
            pointHint: 'Hold your finger until your dog looks at you (♥). Then swipe the way to go and let go!',
            pointLookFirst: 'Eye contact first!', pointOwnWay: 'Following its nose!', pointFound: 'Found!', pointGold: 'GOLDEN BONE!',
            pointNothing: 'Nothing here', pointStolen: 'Stolen!', pointFinds: 'Found',
            // Scent Match
            scentHint: 'Every smell is a little pattern. Tap the jar that smells exactly like the mitten! Stuck? The 👃 button rules out wrong jars. Tap to start!',
            scentFind: 'Find this smell!', scentRight: 'Match!', scentWrong: 'Achoo!', scentLevel: 'Level {n}', scentLevelUp: 'Level {n}!',
            scentNoHints: 'No sniffs left', scentMatches: 'Matches',
            // Night Eyes
            eyesHint: 'Night falls and eyes shine in the dark. Look at the pupils! Slits or round ones: a hunter. Tap it and your dog barks it away from the fish. Bars: a grazer. Leave it alone! Tap to start!',
            eyesBark: 'Bark!', eyesLeave: 'Leave it', eyesWoof: 'WOOF!', eyesChased: 'Chased off',
            eyesJust_deer: 'Just a deer!', eyesJust_goat: 'Just a goat!', eyesStole: '{animal} took a fish!', eyesA_fox: 'A fox', eyesA_wolf: 'A wolf', eyesA_bear: 'A bear',
            // Howl Chorus
            howlHint: 'Hold your finger on a line to howl. Slide up or down to change the note. Wolves never howl on the same note: keep off the notes your pack mates sing! Tap to start!',
            howlBreath: 'Catch your breath!', howlHarmony: 'Harmony! +{n}', howlOut: 'Out of breath!', howlUnison: 'Same note!', howlRivals: 'The rival pack backs off!',
            howlJoin: '{name} joins in!', howlWild: 'A wild wolf', howlSounds: 'Sounds like {n} wolves', howlSounds1: 'Sounds like 1 wolf', howlRivalsLbl: 'Rivals',
            howlBest: 'Sounded like {n} wolves', howlBest1: 'Sounded like 1 wolf', howlBacks: 'Rivals scared off: {n}',
            // Word Genius
            wordsHint: 'The child gives every toy a name. Remember the names and tap the toy the child asks for! A name you have never heard? It belongs to the toy nobody has named yet.',
            wordsTeach: 'This is {name}!', wordsAsk: 'Bring {name}!', wordsRight: 'Right!', wordsFast: 'Quick!', wordsFastMap: 'New word!',
            wordsWrong: 'Not that one!', wordsRightN: 'Right', wordsKnows: '{name} knows {n} words.', wordsRico: 'More than Rico!', wordsChaser: 'As many as Chaser!',
            wordsAdj: 'Zippy,Wobbly,Fizzy,Bumble,Snuggly,Pippin,Squeaky,Noodle,Puddle,Tickle,Doodle,Jelly,Muffin,Popcorn,Sprinkle,Wiggly,Bubble,Cuddle,Sparkle,Jumpy'
        },
        tr: {
            playTitle: 'Oyunlar', playSub: 'Bir oyun seç, sonra bir köpek. Her köpeğin yeteneği farklı!',
            pickDogFor: 'Kim oynayacak?', needAdult: 'Yalnızca büyümüş köpekler oynayabilir.',
            playLocked: 'Oyunlar, ilk yavrun büyüyünce açılır.', unlockAt: '{n}. bölümde açılır',
            unlockScent: 'Açıldı: Koku Eşleştir!', unlockEyes: 'Açıldı: Gece Gözleri!', unlockHowl: 'Açıldı: Uluma Korosu!',
            gPlay: '{n} mini oyun oyna',
            pointTitle: 'İşaret Et!', wordsTitle: 'Kelime Dâhisi', scentTitle: 'Koku Eşleştir', eyesTitle: 'Gece Gözleri', howlTitle: 'Uluma Korosu',
            skillFetch: 'Uysal köpekler sopayı daha hevesle kovalar.',
            skillPoint: 'Uysal köpekler işaretini daha iyi izler. Kurtlar hiç bakmaz!',
            skillWords: 'Uysal köpekler isimleri daha hızlı öğrenir.',
            skillScent: 'Uzun burun daha iyi koklar: daha çok ipucu.',
            skillEyes: 'Dik kulaklar tehlikeyi önce duyar.',
            skillHowl: 'Köpek ne kadar yabaniyse o kadar uzun ulur.',
            factFetch: 'Bazı kurt yavruları atılan topu geri getirir: getir oyunu köpeklerden bile eski.',
            factPoint: 'Yalnızca uysallık için seçilen tilkiler işareti köpekler kadar iyi anladı. Yabani tilkiler anlamadı.',
            factWords: 'Chaser adlı border collie 1.022 oyuncağın adını biliyordu.',
            factScent: 'Köpeğin burnunda yüz milyonlarca koku alıcısı var. Bizde yalnızca birkaç milyon.',
            factEyes: 'Göz bebeği hayvanı ele verir: dikey yarıklar pusuda avlanır, yatay çizgiler otlar.',
            factHowl: 'Kurtlar farklı notalarda ulur; böylece küçük bir sürü kalabalık görünür.',
            pointHint: 'Köpeğin sana bakana kadar parmağını basılı tut (♥). Sonra gideceği yöne kaydır ve bırak!',
            pointLookFirst: 'Önce göz göze gelin!', pointOwnWay: 'Burnunun peşinde!', pointFound: 'Buldu!', pointGold: 'ALTIN KEMİK!',
            pointNothing: 'Burada yok', pointStolen: 'Kaptı!', pointFinds: 'Bulunan',
            scentHint: 'Her kokunun kendine has bir deseni var. Eldivenle tıpatıp aynı kokan kavanoza dokun! Takıldın mı? 👃 düğmesi yanlış kavanozları eler. Başlamak için dokun!',
            scentFind: 'Bu kokuyu bul!', scentRight: 'Eşleşti!', scentWrong: 'Hapşu!', scentLevel: 'Seviye {n}', scentLevelUp: 'Seviye {n}!',
            scentNoHints: 'Koklama hakkı kalmadı', scentMatches: 'Eşleşme',
            eyesHint: 'Gece oldu, karanlıkta gözler parlıyor. Göz bebeklerine bak! Yarık ya da yuvarlaksa avcıdır: dokun, köpeğin havlayıp onu balıklardan uzaklaştırsın. Yatay çizgiyse otçuldur: ona dokunma! Başlamak için dokun!',
            eyesBark: 'Havla!', eyesLeave: 'Dokunma', eyesWoof: 'HAV!', eyesChased: 'Kovulan',
            eyesJust_deer: 'Sadece bir geyik!', eyesJust_goat: 'Sadece bir keçi!', eyesStole: '{animal} bir balık kaptı!', eyesA_fox: 'Tilki', eyesA_wolf: 'Kurt', eyesA_bear: 'Ayı',
            howlHint: 'Ulumak için parmağını bir çizginin üstünde tut. Notayı değiştirmek için yukarı aşağı kaydır. Kurtlar aynı notada ulumaz: sürü arkadaşlarının notalarından uzak dur! Başlamak için dokun!',
            howlBreath: 'Önce nefeslen!', howlHarmony: 'Ahenk! +{n}', howlOut: 'Nefesin bitti!', howlUnison: 'Aynı nota!', howlRivals: 'Rakip sürü geri çekildi!',
            howlJoin: '{name} koroya katıldı!', howlWild: 'Yabani bir kurt', howlSounds: '{n} kurt gibi duyuluyor', howlSounds1: '1 kurt gibi duyuluyor', howlRivalsLbl: 'Rakipler',
            howlBest: '{n} kurt gibi duyuldu', howlBest1: '1 kurt gibi duyuldu', howlBacks: 'Kaçan rakip: {n}',
            wordsHint: 'Çocuk her oyuncağa bir ad veriyor. Adları aklında tut ve istediği oyuncağa dokun! Hiç duymadığın bir ad mı? O ad, henüz adı konmamış oyuncağın.',
            wordsTeach: 'Bu: {name}!', wordsAsk: '{name} getir!', wordsRight: 'Doğru!', wordsFast: 'Hızlı!', wordsFastMap: 'Yeni kelime!',
            wordsWrong: 'O değil!', wordsRightN: 'Doğru', wordsKnows: '{name} {n} kelime biliyor.', wordsRico: 'Rico’yu geçti!', wordsChaser: 'Chaser kadar!',
            wordsAdj: 'Zıpzıp,Pıtır,Fıstık,Bıcır,Tombi,Cicik,Pofi,Kıpır,Lokum,Minnoş,Şıpşıp,Tıntın,Fıkfık,Zuzu,Cimcime,Pışpış,Gıdı,Bobi,Pamuk,Tontik'
        }
    });
})();
