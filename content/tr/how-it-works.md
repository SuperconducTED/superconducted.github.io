---
title: "Nasıl çalışır"
kicker: "Yöntem"
description: "SuperconducTED'in, bir kuantum bilgisayarın sürüklenen kalibrasyon kaydını Qiskit Aer için gürültü parametrelerine nasıl dönüştürdüğü: önce sade bir dille, sonra denklemlerle."
lead: "İlk dört bölüm fikri sade bir dille anlatır. Ardından denklemler gelir; matematiği motorun koduyla karşılaştırabilirsiniz."
toc: true
math: true
---

## Değişen bir makine

IBM, kuantum bilgisayarlarının her biri için kalibrasyon verisi yayımlar: her kübitin durumunu
ne kadar süre koruduğu (T1 ve T2), bir kapının ne sıklıkla hata yaptığı, bir ölçümün ne sıklıkla
yanlış okunduğu.

- **Bu sayılar sürüklenir;** çip ve soğutucusu değiştikçe bazen yavaşça, bazen sıçramalarla.
- **Kanıtı [ana sayfada](../):** `ibm_fez` üzerindeki bir kübitin Mayıs'tan Ekim 2026'ya kadar
  gerçek T1 kalibrasyonları.

Qiskit'in `NoiseModel.from_backend` fonksiyonu en son kalibrasyonu bir gürültü modeline kopyalar.
Model alındığı an için doğrudur ve simülasyonunuzdaki hiçbir şey makinenin o andan beri ne kadar
değiştiğini göstermez.

## Yedi aşamalı hat

SuperconducTED, kalibrasyon verisi ile simülatör Qiskit Aer arasında durur. Her anlık görüntü
yedi aşamadan geçer:

1. **Alma.** Zamanlanmış bir iş, Mayıs 2026'dan beri IBM'in `ibm_fez` makinesinin
   kalibrasyonlarını herkese açık biçimde arşivliyor.
2. **Özetleme.** Anlık görüntüyü üç öznitelik tanımlar: ortalama T1, ortalama T2 ve ortalama
   okuma hatası.
3. **Bulanıklaştırma.** Her öznitelik birbiriyle örtüşen bulanık kümelerle ("düşük", "olağan",
   "yüksek") tanımlanır. Kümelerin her birleşimi bir kuraldır ve her kural, anlık görüntü ona ne
   kadar uyuyorsa o kadar güçlü ateşlenir.
4. **Birleştirme.** Her kural, gürültü parametrelerini özniteliklerin doğrusal bir fonksiyonu
   olarak önerir; motor bu önerilerin, ateşlenme gücüyle ağırlıklı ortalamasını alır.
5. **Sıkıştırma.** Sonuç, fiziksel parametrenin alabileceği aralığa eşlenir.
6. **Uygunluk denetimi.** Yalnızca anlık görüntünün raporladığı kapılar bir gürültü kanalı alır.
7. **İzdüşüm.** Parametreler, Aer'in simüle ettiği genlik ve faz sönümü kanallarına dönüşür.

Kural tabanı bir Takagi-Sugeno-Kang (TSK) bulanık sistemidir. ANFIS bu tabanı küçük bir sinir
ağının eğitildiği gibi eğitir.

## Neden bir aralık

Tek bir kalibrasyon, sürekli değişen bir makineden alınmış tek bir örnektir.

- **Aralık tip-2 bulanık kümenin** bir alt ve bir üst üyeliği vardır. İkisinin arasındaki boşluk,
  girdi hakkında bilinmeyeni taşır.
- **Bu belirsizliği kapsayan bir gürültü modeli topluluğu**, tek bir simülasyonu bir sonuç
  aralığına dönüştürür.
- **Amaç**, donanımın kalibrasyon döngüleri boyunca yaptığını kapsayan bir aralıktır.

## Şu anki durum

> Araştırma önizlemesi. Bu bölüm bir sonucu değil, motorun durumunu anlatır.

- **Çalışanlar:** kalibrasyon arşivi, öznitelik çıkarımı, uçtan uca bulanık hat, kanal izdüşümü
  ve bir Aer gürültü modeli topluluğu. Test takımında {{% claim "tests" %}} test var.
- **Sürenler:** eğitim. Kural çıktılarının ridge en küçük kareler uydurması 15 Ekim 2026'da
  birleştirildi [PR #114](https://github.com/SuperconducTED/superconducted-noise-engine/pull/114).
  Eğitim, eğitilebilir parametre başına beş farklı cihaz durumu, toplam {{% claim "floor" %}}
  durum gerektirir; {{% claim "states" %}} tanesi arşivde.
- **Açık olanlar:** topluluk üyelerinin nasıl farklılaşacağı
  [ADR-015](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md),
  sonuçlarının bir aralıkta nasıl birleşeceği
  [ADR-016](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md)
  ve tip-1 mi aralık tip-2 mi
  [ADR-009](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md).
  Bunlar netleşene kadar çıktılar nokta tahminleridir.

Her tasarım kararı motorun
[karar kaydında](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md),
tasarımın kendisi
[mimari belgesinde](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md),
her sayı da
[sayısal iddialar kaydında](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md)
yer alır.

## Denklemler

Tanımlar motorun kodundakilerle aynıdır (`fuzzy/membership.py`, `fuzzy/tsk.py`,
`fuzzy/defuzzification.py`, `channels/kraus.py`).

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

Öznitelik başına üç kümeyle \(R = 3^3 = 27\) kural ve {{% claim "params" %}} eğitilebilir
parametre vardır: 216'sı \(A_r\) matrislerinde, 18'i merkez ve genişliklerde
[NC-037](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md).

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

**Aralık.** Aralığın topluluktan gelmesi planlanıyor: \(N\) gürültü modeli (varsayılan olarak
{{% claim "ensemble" %}}) ayrı ayrı simüle edilir ve sonuçları bir aralıkta birleştirilir.
Üyelerin nasıl farklılaşacağı ve sonuçlarının nasıl birleşeceği yukarıdaki açık kararlardır.
