# Berna – Focus with Miki

Minimal siyah-beyaz, iPhone ana ekranına eklenebilir Pomodoro uygulaması.

## Özellikler
- Çalışma, kısa mola ve uzun mola sayaçları
- Pomodoro boyunca davranışı değişen gri kedi Miki
- Miki'ye dokunma animasyonu ve oturum sonu kutlaması
- Galeriden özel arka plan fotoğrafı seçme
- Arka plan karartma ve bulanıklık ayarları
- Fotoğrafın yalnızca cihazda IndexedDB içinde saklanması
- Günlük çalışma süresi, Pomodoro, hedef ve seri takibi
- İnternet olmadan çalışma desteği

## Hemen bilgisayarda çalıştırma
Bu klasörde terminal açıp şunu çalıştırın:

```bash
python3 -m http.server 8000
```

Ardından tarayıcıda `http://localhost:8000` adresini açın. Dosyaya çift tıklamak yerine yerel sunucu kullanmak PWA özelliklerinin doğru çalışmasını sağlar.

## Ücretsiz yayınlama
1. GitHub'da yeni bir depo oluşturun.
2. Bu klasördeki tüm dosyaları depoya yükleyin.
3. Settings > Pages bölümüne girin.
4. Source: `Deploy from a branch`, branch: `main`, klasör: `/root` seçin.
5. Oluşan bağlantıyı iPhone'da Safari ile açın.
6. Paylaş > Ana Ekrana Ekle seçeneğine dokunun.

Not: iOS web uygulamalarında zamanlayıcı arka planda kısıtlanabilir; uygulama yeniden açıldığında sayaç gerçek bitiş zamanına göre kendini düzeltir.
