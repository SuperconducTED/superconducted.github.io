---
title: "ANFIS eğitiminin ilk adımı birleştirildi"
date: 2026-10-17
description: "Motor artık bulanık kurallarının çıktılarını ridge en küçük karelerle uydurabiliyor; bu, ANFIS eğitiminin ilk yarısı. Bu hafta ayrıca projenin kimliği ve bu web sitesi yayına girdi."
lead: "Motor artık bulanık kurallarının çıktı tarafını uydurabiliyor. Bunun neyi kapsadığı, henüz neyi yapmadığı ve bu hafta başka neyin değiştiği aşağıda."
---

## Ne birleştirildi

[PR #114](https://github.com/SuperconducTED/superconducted-noise-engine/pull/114) 15 Ekim 2026'da
birleştirildi. ANFIS eğitiminin ilk yarısını ekliyor: her kuralın doğrusal çıktısını ridge en
küçük karelerle uydurmak.

- **İki kural türü de.** Uydurma hem tip-1 yolunda hem aralık tip-2 yolunda (Nie-Tan) çalışıyor.
- **Önceden yerleştirilmiş yanıtlarla sınandı.** Testler, çıktıları bilinen 3 × 3 × 3 bir kural
  tabanı kuruyor; uydurma bu çıktıları iki yolda da geri buluyor.
- **Birimleriniz girer, birimleriniz çıkar.** Girdiler uydurma için standartlaştırılıyor ve ham
  birimlere tam olarak geri dönüştürülüyor.

## Henüz yapmadığı

- **Bulanık küme eğitimi yok.** ANFIS'in her kümenin merkezini ve genişliğini değiştiren ikinci
  yarısı, sıradaki iş.
- **Arşiv üzerinde çalıştırma yok.** Eğitim {{% claim "states_of" %}} farklı cihaz durumu
  gerektiriyor; şu ana kadar {{% claim "states" %}} tanesi arşivlendi.

## Bu hafta ayrıca

- **Bir kimlik.** Organizasyon, logosunu ve renklerini 16 Ekim 2026'da benimsedi (organizasyon
  deposunda [PR #1](https://github.com/SuperconducTED/.github/pull/1)).
- **Bu web sitesi.** Aynı gün yayına girdi (site deposunda
  [PR #1](https://github.com/SuperconducTED/superconducted.github.io/pull/1)). Sitedeki her sayı,
  geldiği kayıt satırına bağlanır.
