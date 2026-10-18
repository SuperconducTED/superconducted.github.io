---
title: "Başlarken"
kicker: "Kurulum"
description: "SuperconducTED gürültü motorunu kurun, testlerini çalıştırın, IBM kalibrasyonlarını toplayın ve projeye katılın."
lead: "Aşağıdaki komutlarla motoru kurup test takımını çalıştırın. Python 3.11 veya daha yeni bir sürüm ve git gerekir; her kod bloğunda bir Kopyala düğmesi var."
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

Test takımında {{% claim "tests" %}} test var ve IBM hesabı gerekmez.

```bash
pytest
```

## IBM kalibrasyonlarını toplama

`superconducted-poll` bir IBM arka ucundan kalibrasyon anlık görüntülerini arşivler. Bir IBM
Quantum belirteci (token) gerekir.

```bash
cp .env.example .env
superconducted-poll --backend ibm_fez
```

- **Belirteç nereye yazılır:** `.env` dosyasına, `IBM_QUANTUM_TOKEN` olarak.
- **Asla işlemeyin (commit etmeyin).** git `.env` dosyasını yok sayar; öyle kalsın.
- **Toplama başarısız olursa** motorun
  [README dosyası](https://github.com/SuperconducTED/superconducted-noise-engine#readme) hataları
  ve çözümlerini listeler.

## Tasarımı okuma

- [Mimari](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/architecture.md):
  yedi aşamalı hat ve Qiskit Aer ile nasıl buluştuğu.
- [Karar kaydı](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md):
  her mimari karar ve durumu.
- [Sayısal iddialar kaydı](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/numerical-claims.md):
  projenin belirttiği her sayının nereden geldiği.

## Katılım

- **Sorular ve fikirler:** motorun
  [Tartışmalar](https://github.com/SuperconducTED/superconducted-noise-engine/discussions) bölümü.
- **Hatalar:** [konular](https://github.com/SuperconducTED/superconducted-noise-engine/issues)
  bölümü.
- **Büyük bir değişiklik:** önce bir konu açın; böylece iş başlamadan yaklaşım üzerinde ekiple
  uzlaşırsınız. Kod MIT lisansı altındadır.
