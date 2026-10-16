---
title: "SuperconducTED"
lead: "Kuantum bilgisayarlar sürüklenir. Gürültüleri günde birçok kez yeniden ölçülür, ama tek bir kalibrasyondan kurulan bir simülatör o tek anlık görüntüyü kullanmaya devam eder. SuperconducTED, Qiskit Aer için kalibrasyon geçmişinden öğrenen ve bir aralıkla yanıt veren bir gürültü motoru geliştiren bir öğrenci araştırma projesidir."
steps:
  - title: "Donanım sürüklenir"
    text: "Bir kübitin T1, T2 ve hata oranları günde birçok kez yeniden ölçülür ve yukarıdaki grafikte görüldüğü gibi bir kalibrasyondan diğerine değişir."
  - title: "Anlık görüntü onu dondurur"
    text: "Qiskit'in `NoiseModel.from_backend` fonksiyonu tek bir kalibrasyondan bir gürültü modeli kurar. Model o an için doğrudur; makine değiştikçe sessizce yanlışlaşır."
  - title: "Motor bir aralıkla yanıt verir"
    text: "SuperconducTED, kalibrasyon özniteliklerinin gürültüyle ilişkisini öğrenir ve simülasyonlara tek bir kesin sayı yerine donanımın davranışını kapsayan bir aralık vermeyi hedefler."
---
