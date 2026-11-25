# Changelog

## 0.0.2 (beta)
- Camera curții: poze succesive din `camera_proxy` (cam una pe secundă, doar cât tab-ul e vizibil) în locul transmisiei MJPEG, care rămânea agățată în proxy-ul Supervisor-ului și îi umfla memoria (#1). Când camera nu dă imagine, apare „FĂRĂ IMAGINE”.
- Opțiune nouă `yard_camera`: alegi camera afișată; goală = alegere automată ca până acum (#2).
- Jurnalul (și rândul de sub salut) arată doar domeniile utile omului: lumini, prize, prezență/uși, climă, jaluzele, încuietori, media etc. Valorile care se schimbă des (`number`, `sensor`, `select`…) nu mai intră (#3).

## 0.0.1 (beta)
- Ecranul HUD: zonele din HA cu prezență și lumini, camera curții, jurnalul, bara de stare.
- Chat text și voce (push-to-talk: ține Space sau butonul de microfon) prin pipeline-ul Assist existent, cu eticheta „via local / via <agent>”.
- Confirmare obligatorie pentru aparatele protejate; poarta și entitățile read-only doar se afișează.
- Starea offline cu reconectare automată.
- Microfonul se deschide doar la apăsare, cu indicator vizibil, și se închide când tab-ul pierde focusul.
