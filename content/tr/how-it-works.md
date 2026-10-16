---
title: "Nasıl çalışır"
description: "SuperconducTED'in, bir kuantum bilgisayarın sürüklenen kalibrasyon kaydını Qiskit Aer için bir gürültü aralığına dönüştürmeyi nasıl hedeflediği: önce sade bir dille, sonra denklemlerle."
lead: "Bir kuantum bilgisayarın gürültüsü günde birçok kez yeniden ölçülür ve sürekli değişir. Bu sayfa, SuperconducTED'in bu değişen kaydı bir simülasyonun kullanabileceği bir aralığa nasıl dönüştürmeyi hedeflediğini önce sade bir dille, sonra denklemlerle anlatır."
toc: true
math: true
---

## Değişen bir makine

IBM, kuantum bilgisayarlarının her birinin gürültüsünü günde birçok kez ölçer: her kübitin
durumunu ne kadar süre koruduğunu (T1 ve T2), bir kapının ne sıklıkla hata yaptığını, bir
ölçümün ne sıklıkla yanlış okunduğunu. Bu sayılar sabit değildir. Çip ve soğutucusu değiştikçe,
bazen yavaşça, bazen sıçramalarla sürüklenirler.

Simülatörlerin bu sayılara ihtiyacı vardır. Qiskit'te `NoiseModel.from_backend`, makinenin en son
kalibrasyonundan bir gürültü modeli kurar. Bu model, alındığı an için doğrudur; makine değiştiği
anda ise sessizce yanlışlaşır ve simülasyondaki hiçbir şey ne kadar yanlış olduğunu söylemez.

## Motor ne yapar

SuperconducTED, kalibrasyon verisi ile simülatör Qiskit Aer arasında durur. Her kalibrasyon
anlık görüntüsü yedi aşamadan geçer:

1. **Alma.** Anlık görüntü arşivlenir. Mayıs 2026'dan beri zamanlanmış bir iş, bir IBM
   makinesinin (`ibm_fez`) kalibrasyonlarını herkese açık bir arşivde topluyor.
2. **Özetleme.** Anlık görüntüyü üç öznitelik tanımlar: çip genelinde ortalama T1, ortalama T2
   ve ortalama okuma hatası.
3. **Bulanıklaştırma ve kuralların ateşlenmesi.** Her öznitelik "düşük", "olağan" ve "yüksek"
   gibi birbiriyle örtüşen bulanık kümelerle tanımlanır. Kümelerin her birleşimi bir kuraldır ve
   her kural, anlık görüntü ona ne kadar uyuyorsa o kadar güçlü ateşlenir.
4. **Birleştirme.** Her kural, öznitelikleri doğrusal bir fonksiyonla gürültü parametrelerine
   dönüştüren bir öneri sunar; motor bu önerilerin, kuralların ateşlenme gücüyle ağırlıklı
   ortalamasını alır.
5. **Sıkıştırma.** Sonuç, fiziksel bir parametrenin alabileceği aralığa eşlenir.
6. **Uygunluk denetimi.** Yalnızca anlık görüntünün gerçekten raporladığı kapılar bir gürültü
   kanalı alır.
7. **İzdüşüm.** Parametreler, Aer'in simüle edebileceği bir kuantum kanalına (genlik ve faz
   sönümü) dönüşür.

Kural tabanı bir Takagi-Sugeno-Kang (TSK) bulanık sistemidir. Hâlen sürmekte olan eğitim,
kümeleri ve kuralları, bir bulanık sistemi küçük bir sinir ağı gibi eğiten ANFIS yöntemiyle
arşivden öğrenir.

## Neden bir aralık

Tek bir kalibrasyon, sürekli değişen bir makineden alınmış tek bir örnektir. Bir bulanık sistem
kendi girdilerinin belirsizliğini taşıyabilir: aralık tip-2 bulanık kümenin bir alt ve bir üst
üyeliği vardır ve ikisinin arasındaki boşluk bilinmeyeni taşır. Bu belirsizliği kapsayan bir
gürültü modeli topluluğuyla çalıştırıldığında simülasyon tek bir sayı yerine bir sonuç aralığı
döndürür. Amaç, gerçek donanımın kalibrasyon döngüleri boyunca yaptığını kapsayan bir aralıktır;
tek bir dondurulmuş model bunu yapamaz.

## Şu anki durum

> SuperconducTED bir araştırma önizlemesidir. Aşağıdakiler bir sonuç değil, motorun durumudur.

- **Bugün çalışanlar:** kalibrasyon arşivi, öznitelik çıkarımı, uçtan uca bulanık hat, kanal
  izdüşümü ve bir Aer gürültü modeli topluluğu.
- **Sürmekte olan:** kural tabanının arşiv üzerinde eğitilmesi. Eğitim için yeterli sayıda farklı
  cihaz durumu gerekir: eğitilebilir parametre başına en az beş, toplam 1.170 (kayıt satırı
  NC-045).
- **Açık sorular:** topluluk üyelerinin birbirinden nasıl farklılaştırılacağı (ADR-015), sonuçlarının
  bir aralıkta nasıl birleştirileceği (ADR-016) ve tip-1 ile aralık tip-2 yollarından hangisinin
  kullanılacağı (ADR-009). Bunlar netleşene kadar motorun çıktıları nokta tahminleridir.

Her tasarım kararı motorun
[karar kaydında](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md),
tasarımın kendisi
[mimari belgesinde](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md),
her sayı da
[sayısal iddialar kaydında](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md)
yer alır.

## Denklemler

Matematiği görmek isteyen okurlar için. Tanımlar motorun kodundakilerle aynıdır
(`fuzzy/membership.py`, `fuzzy/tsk.py`, `fuzzy/defuzzification.py`, `channels/kraus.py`).

**Öznitelikler.** Bir anlık görüntü \(x = (x_1, x_2, x_3)\) verir: ortalama T1, ortalama T2 ve
ortalama okuma hatası.

**Üyelik.** Her \(r\) kuralının her öznitelik için, merkezi \(c\) ve genişliği \(\sigma\) eğitimle
öğrenilen bir Gauss kümesi vardır:

$$
\mu_{r,i}(x_i) = \exp\left(-\frac{1}{2}\left(\frac{x_i - c_{r,i}}{\sigma_{r,i}}\right)^{2}\right)
$$

**Ateşleme gücü.** Kuralın üyeliklerinin çarpımı:

$$
w_r(x) = \prod_{i=1}^{3} \mu_{r,i}(x_i)
$$

**Kural çıktısı.** Birinci dereceden TSK: her kural iki gürültü parametresini özniteliklerin
doğrusal bir fonksiyonu olarak önerir:

$$
y_r(x) = A_r \begin{bmatrix} x \\ 1 \end{bmatrix}, \qquad A_r \in \mathbb{R}^{2 \times 4}
$$

**Birleştirme.** Önerilerin \(R\) kural üzerinden, ateşleme gücüyle ağırlıklı ortalaması:

$$
y(x) = \frac{\sum_{r=1}^{R} w_r(x)\, y_r(x)}{\sum_{r=1}^{R} w_r(x)}
$$

Öznitelik başına üç kümeyle \(R = 3^3 = 27\) kural ve 234 eğitilebilir parametre vardır: 216'sı
\(A_r\) matrislerinde, 18'i merkez ve genişliklerde (kayıt satırları NC-037 ve NC-045).

**Kanal.** Sıkıştırma \(y\)'yi, ikisi de \([0, 1]\) aralığında olan bir genlik sönümü parametresi
\(\gamma\) ile bir faz sönümü parametresi \(\lambda\)'ya dönüştürür. Her uygun kapı, Kraus
operatörleri

$$
K_0 = \begin{bmatrix} 1 & 0 \\ 0 & \sqrt{1-\gamma} \end{bmatrix}, \qquad
K_1 = \begin{bmatrix} 0 & \sqrt{\gamma} \\ 0 & 0 \end{bmatrix}
$$

olan genlik sönümünü, \(\lambda\) parametreli faz sönümüyle birleşik olarak alır.

**Tip-2 yolu.** Aralıklı bir Gauss kümesinin iki genişliği vardır,
\(\sigma^{\mathrm{low}} < \sigma^{\mathrm{high}}\); böylece her üyelik bir aralık olur ve her
kural bir alt güç \(\underline{w}_r\) ile bir üst güç \(\overline{w}_r\) ile ateşlenir. Motorun
Nie-Tan durulaştırıcısı iki ağırlıklı ortalamanın ortalamasını alır:

$$
y(x) = \frac{1}{2}\left(
\frac{\sum_{r} \underline{w}_r(x)\, y_r(x)}{\sum_{r} \underline{w}_r(x)} +
\frac{\sum_{r} \overline{w}_r(x)\, y_r(x)}{\sum_{r} \overline{w}_r(x)}
\right)
$$

**Aralık.** Motorun bildireceği aralığın topluluktan gelmesi planlanıyor: \(N\) gürültü modeli
(varsayılan olarak 32, kayıt satırı NC-018) ayrı ayrı simüle edilir ve sonuçları bir aralıkta
birleştirilir. Üyelerin nasıl farklılaşacağı ve sonuçlarının nasıl birleştirileceği yukarıdaki
açık sorulardır.
