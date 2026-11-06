# Eco Estelar

Un juego de memoria espacial hecho con HTML, CSS y JavaScript, sin dependencias externas.

## Jugar en el ordenador

Abre `index.html` en el navegador o abre esta carpeta en Visual Studio Code y ejecútala con Live Server. La partida, el sonido y los récords se guardan en el almacenamiento local del navegador.

## Modos de juego

- **Clásico:** tres energías, secuencia creciente y dos ecos para repetirla.
- **Supernova:** cuenta atrás de 60 segundos; los aciertos suman tiempo y los errores lo descuentan.
- **Órbita Zen:** sin reloj ni límite de errores, con tres ecos para ayudarte.

Pulsa **Q, W, A o S** para jugar, **P** para pausar y **R** para reiniciar. También funcionan el clic y el toque.

## Publicar gratis con GitHub Pages

El proyecto incluye un flujo de GitHub Actions en `.github/workflows/deploy-pages.yml`. Al subir los cambios a la rama `main`, se prepara y publica automáticamente el sitio.

1. Guarda y sincroniza los archivos de este proyecto con la rama `main` de GitHub.
2. En el repositorio, abre **Settings → Pages** y elige **GitHub Actions** como origen de publicación.
3. En **Actions**, espera a que termine el flujo **Publicar Eco Estelar en GitHub Pages**.
4. Abre el enlace que aparece en **Settings → Pages**. Para este repositorio suele ser `https://mariiono12.github.io/Desaf-o-de-Inteligencia-Artificial/`.

El juego también incluye un manifiesto y caché sin conexión: una vez visitado en un navegador compatible, puede seguir funcionando sin red.
