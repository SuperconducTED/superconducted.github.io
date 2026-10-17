---
title: "SuperconducTED"
description: "TED Üniversitesi'nde yürütülen bir öğrenci araştırma projesi: kuantum bilgisayarın kalibrasyon geçmişinden öğrenen ve gürültüyü bir aralık olarak veren, Qiskit Aer için bir gürültü motoru."
# Ana sayfa metni. Düzen: layouts/home.html. {claim:KEY}, kayıtla desteklenen bir sayıyı kanıt
# etiketiyle yazar (data/facts.yaml, data/claims.yaml); kayıttaki bir sayıyı elle yazmayın.
hero:
  eyebrow: "Araştırma önizlemesi · TED Üniversitesi, Ankara"
  title_before: "Kuantum gürültü modelinize bir"
  title_range: "aralık"
  title_after: "verin."
  sub: "Tek bir kalibrasyondan kurulan gürültü modeli, çip sürüklendikçe eskir. **SuperconducTED, Qiskit Aer için bir gürültü motoru geliştiriyor.** Motor kalibrasyon geçmişinin tamamından öğrenir; böylece simülasyonunuz donanımı izleyen bir aralık verebilir."
  primary:
    label: "Motorun nasıl çalıştığını görün"
    url: "how-it-works/"
  secondary:
    label: "Kurun ve testleri çalıştırın"
    url: "get-started/"
  note: "Çalışma sürüyor: hat uçtan uca çalışıyor, eğitim ve aralık çıktısı ise hâlâ geliştiriliyor. Ölçülmüş bir sonuç belirtilmedikçe bu sitede anlatılanlar hedeftir."
problem:
  kicker: "01 / Sorun"
  title: "Tek bir kalibrasyon simülasyonunuzu neden yanıltır"
  intro: "Donanımdan sonuçlarınıza üç adım. Yukarıdaki grafik ilk adımın kanıtıdır."
  steps:
    - title: "Çip sürüklenir"
      text: "T1, T2 ve hata oranları bir kalibrasyondan diğerine değişir. Arşivimizde, Mayıs 2026'dan bu yana IBM ibm_fez'in {claim:states} farklı cihaz durumu var."
    - title: "Modeliniz tek bir anı dondurur"
      text: "`NoiseModel.from_backend` en son kalibrasyonu sabit bir gürültü modeline kopyalar. Model o an için doğrudur ve hiç güncellenmez."
    - title: "Sonuçlarınız bu farkı devralır"
      text: "Devreyi bir hafta sonra çalıştırın; model hâlâ geçen haftanın sayılarını kullanır. Çıktıdaki hiçbir şey ne kadar saptığını söylemez."
approach:
  kicker: "02 / Yaklaşım"
  title: "Her kalibrasyondan öğrenen bir gürültü motoru"
  intro: "SuperconducTED, IBM'in kalibrasyon verisiyle simülatör Qiskit Aer arasında durur."
  points:
    - title: "Kalibrasyonun gürültüye nasıl dönüştüğünü öğrenir"
      text: "Bulanık bir kural tabanı, her anlık görüntünün üç özniteliğini (ortalama T1, ortalama T2, ortalama okuma hatası) gürültü parametrelerine çevirir; şu an süren ANFIS eğitimi bu tabanı arşive uydurur."
    - title: "Akıl yürütmesi okunabilir kalır"
      text: "Her kural kalibrasyon uzayının bir bölgesini kapsar (örneğin düşük T1 ve yüksek okuma hatası); böylece neyin öğrenildiğini inceleyebilirsiniz. Kural tabanında {claim:params} eğitilebilir parametre var."
    - title: "Bir aralık verir"
      text: "Plan şu: bir gürültü modeli topluluğu (varsayılan olarak {claim:ensemble} model) tek bir simülasyonu sonuçların bir aralığına dönüştürür."
  link:
    label: "Yöntemi ve denklemleri okuyun"
    url: "how-it-works/"
status:
  kicker: "03 / Durum"
  title: "Ekim 2026'da motor"
  intro: "Her iddia kanıtını yanında taşır. Arkasındaki kaydı görmek için etiketi açın."
  working:
    title: "Çalışıyor"
    items:
      - "**Kalibrasyon arşivi:** ibm_fez, Mayıs 2026'dan beri toplanıyor; öznitelik çıkarımı dahil."
      - "**Uçtan uca bulanık hat:** bir anlık görüntüden Aer gürültü kanallarına."
      - "Motorun test takımında **{claim:tests} test**."
  progress:
    title: "Sürüyor"
    items:
      - "**ANFIS eğitimi.** Kural çıktılarının en küçük kareler uydurması 15 Ekim 2026'da birleştirildi [PR #114](https://github.com/SuperconducTED/superconducted-noise-engine/pull/114). Sırada bulanık kümelerin eğitimi var."
      - "**Eğitim verisi:** eğitimin gerektirdiği {claim:states_of} cihaz durumunun {claim:states} tanesi arşivde."
  open:
    title: "Açık kararlar"
    items:
      - "Topluluk üyelerinin nasıl farklılaşacağı [ADR-015](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md) ve bir aralıkta nasıl birleşeceği [ADR-016](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md)."
      - "Tip-1 mi, aralık tip-2 kurallar mı [ADR-009](https://github.com/SuperconducTED/superconducted-noise-engine/blob/main/docs/decisions.md)."
  note: "Bu kararlar verilene kadar motorun çıktıları nokta tahminleridir."
faq:
  kicker: "04 / Sorular"
  title: "Denemeden önce"
  items:
    - q: "Araştırmamda bugün kullanabilir miyim?"
      a: "Kurabilir, hattın tamamını ve test takımını çalıştırabilirsiniz. Çıktıları hâlâ nokta tahminleridir; eğitim ve aralık çıktısı tamamlanana kadar bunları sonuç olarak göstermeyin. Tamamlandığında [Güncellemeler](updates/) sayfasında duyurulacak."
    - q: "IBM Quantum hesabı gerekir mi?"
      a: "Motoru kurmak ya da testlerini çalıştırmak için gerekmez. IBM Quantum anahtarı yalnızca canlı kalibrasyonları kendiniz toplamak için gerekir. Motorun eğitildiği arşiv, motorun herkese açık deposunda."
    - q: "Her kalibrasyondan sonra modeli yeniden kurmak yetmez mi?"
      a: "Yine tek bir anlık görüntüyü simüle edersiniz ve o da bir sonraki kalibrasyonda eskimeye başlar. Motor, gürültünün geçmiş boyunca nasıl değiştiğini öğrenmek ve iki kalibrasyon arasında beklenecek yayılımı tanımlamak üzere tasarlandı."
    - q: "Neden bulanık mantık?"
      a: "Bulanık bir kural tabanı okunabilir kalır: her kural hangi kalibrasyon koşullarını kapsadığını söyler. Aralık tip-2 bulanık kümeler kendi girdilerinin belirsizliğini de taşıyabilir; bir aralık da tam bunu gerektirir. ANFIS, kuralları küçük bir sinir ağının eğitildiği gibi eğitir."
    - q: "Bu bir IBM projesi mi?"
      a: "Hayır. SuperconducTED, Ankara'daki TED Üniversitesi'nde yürütülen bağımsız bir öğrenci projesidir. IBM'in yayımladığı kalibrasyon verisini ve açık kaynaklı Qiskit Aer simülatörünü kullanır."
    - q: "Nasıl atıf yaparım?"
      a: "Motorun [GitHub sayfasındaki](https://github.com/SuperconducTED/superconducted-noise-engine) **Cite this repository** düğmesini kullanın. Düğme, yazarları listeleyen proje atıf dosyasını okur."
updates:
  kicker: "05 / Güncellemeler"
  title: "Gelişmeleri izleyin"
final:
  kicker: "Sonraki adım"
  title: "Motoru kendi bilgisayarınızda çalıştırın"
  text: "Python 3.11 veya daha yeni bir sürüm ve git gerekir. Kurun, testleri çalıştırın, ardından tasarımı okuyun."
  primary:
    label: "Motoru kurun"
    url: "get-started/"
  secondary_label: "GitHub'da soru sorun"
---
