VELORA – Deine private Vintage-Musikbibliothek
==============================================

Diese Version ist ein erster Prototyp. Sie enthält:
- lokale Speicherung in IndexedDB
- Audio-Dateien importieren
- Songs abspielen, pausieren, vor/zurück
- eigene Playlists mit Beschreibung und Cover
- Profilname und Profilbild
- Songfavoriten
- Backup exportieren und wiederherstellen
- App-Shell-Cache für Offline-Start (nach erfolgreichem ersten Laden)

WICHTIG FÜR IPHONE/IPAD
-----------------------
Eine PWA benötigt für Service Worker und zuverlässige Offline-Installation eine HTTPS-Adresse
(oder localhost für Entwicklung). Öffne die Seite nach dem Hosting einmal online in Safari,
warte, bis sie vollständig geladen ist, und wähle Teilen > Zum Home-Bildschirm.

Die App ist kein App-Store-Paket und kann nicht versprechen, für immer mit jeder iOS-Version
zu funktionieren. iOS kann Website-Daten verwalten oder entfernen. Exportiere regelmäßig ein
Backup über Profil > Backup exportieren. Speichere wichtige Original-MP3-Dateien zusätzlich
in der Dateien-App oder in einem anderen eigenen Backup.

OFFLINE UND MUSIK
-----------------
Die App speichert importierte Audio-Dateien und Playlist-Daten lokal in IndexedDB. Die
Musikwiedergabe im Hintergrund bzw. bei gesperrtem Bildschirm muss auf dem Zielgerät
getestet werden. Importiere keine Dateien, die du nicht rechtmäßig nutzen darfst.

HOSTING
-------
Lade die Dateien aus diesem Ordner auf einen HTTPS-Webhost hoch, der statische Dateien
bereitstellt. Nach dem ersten Online-Aufruf kann der Service Worker die App-Oberfläche
zwischenspeichern. Externe Webfonts werden nur online geladen; lokal sind System-Fallbacks
vorhanden. Für maximale Unabhängigkeit kann die @import-Zeile in style.css entfernt werden.

Dies ist ein Startprototyp und sollte vor der alleinigen Nutzung mit deiner Musiksammlung
getestet werden. Insbesondere große Backups können sehr groß werden.
