---
title: "Başlarken"
description: "SuperconducTED gürültü motorunu kurun, testlerini çalıştırın, IBM kalibrasyonlarını toplayın ve projeye katılın."
lead: "Motoru kurun, testlerini çalıştırın ve projeye nasıl katılabileceğinizi görün. Python 3.11 veya daha yeni bir sürüm ve git gerekir."
toc: true
---

## Kurulum

```bash
git clone https://github.com/SuperconducTED/superconducted-noise-engine.git
cd superconducted-noise-engine
python -m venv .venv
```

Ortamı etkinleştirin: Windows'ta `.venv\Scripts\activate`, macOS ve Linux'ta
`source .venv/bin/activate`. Ardından sabitlenmiş bağımlılıkları ve motorun kendisini kurun:

```bash
pip install -r requirements.txt -r requirements-dev.txt
pip install -e . --no-deps
```

## Testleri çalıştırma

```bash
pytest
```

## IBM kalibrasyonlarını toplama

`superconducted-poll` komutu bir IBM arka ucundan kalibrasyon anlık görüntülerini arşivler. Bir
IBM Quantum belirteci (token) gerekir.

```bash
cp .env.example .env
superconducted-poll --backend ibm_fez
```

Belirtecinizi `.env` dosyasına `IBM_QUANTUM_TOKEN` olarak yazın. `.env` dosyası git tarafından
yok sayılır: gerçek bir belirteci asla işlemeyin (commit etmeyin). Motorun
[README dosyası](https://github.com/SuperconducTED/superconducted-noise-engine#readme), toplama
sırasında karşılaşılabilecek hataları ve çözümlerini listeler.

## Tasarımı okuma

- [Mimari](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md):
  yedi aşamalı hat ve Qiskit Aer ile nasıl buluştuğu.
- [Karar kaydı](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md):
  her mimari karar ve durumu.
- [Sayısal iddialar kaydı](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md):
  projenin belirttiği her sayının nereden geldiği.
- [Nasıl çalışır](../how-it-works/): fikir ve denklemler, bu sitede.

## Katılım

Sorular ve fikirler motorun
[Tartışmalar](https://github.com/SuperconducTED/superconducted-noise-engine/discussions)
bölümüne, hatalar ise
[konular](https://github.com/SuperconducTED/superconducted-noise-engine/issues) bölümüne yazılır.
Büyük bir değişiklik için önce bir konu açın; böylece iş başlamadan yaklaşım üzerinde uzlaşılır.
Kod MIT lisansı altındadır.
