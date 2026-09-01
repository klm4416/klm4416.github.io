(() => {
  "use strict";

  const root = document.getElementById("webgl-intro");
  const canvas = document.getElementById("webgl-intro-canvas");
  const fallbackImage = document.getElementById("webgl-intro-fallback");
  const skipButton = document.getElementById("webgl-intro-skip");
  const status = document.getElementById("webgl-intro-status");
  const profile = document.getElementById("webgl-intro-profile");
  const clock = document.getElementById("webgl-intro-time");
  const cursor = document.getElementById("webgl-intro-cursor");
  const enterButtons = root ? Array.from(root.querySelectorAll("[data-intro-enter]")) : [];

  if (
    !root ||
    !canvas ||
    !fallbackImage ||
    !skipButton ||
    !status ||
    !profile ||
    !clock ||
    !cursor ||
    enterButtons.length === 0
  ) {
    return;
  }

  const storageKey = "klm4416:intro:v2";
  const html = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const currentUrl = new URL(window.location.href);
  const replayRequested = currentUrl.searchParams.get("intro") === "1";
  const profileIndex = profile.querySelector(".webgl-intro__profile-index");
  const profileTitle = profile.querySelector("strong");
  const profileDescription = profile.querySelector("span:last-child");
  const profiles = [
    { index: "01", title: "BUILD", description: "CODE · PRODUCTS · EXPERIMENTS", left: "39%", accent: "8%" },
    { index: "02", title: "THINK", description: "SYSTEMS · IDEAS · RESEARCH", left: "51%", accent: "37%" },
    { index: "03", title: "RECORD", description: "NOTES · LESSONS · ARCHIVE", left: "65%", accent: "67%" },
  ];

  if (html.classList.contains("intro-seen") && !replayRequested) {
    root.hidden = true;
    return;
  }

  if (replayRequested) {
    currentUrl.searchParams.delete("intro");
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    );
  }

  html.classList.remove("intro-seen");
  document.body.classList.add("intro-active");
  root.hidden = false;

  const inertTargets = collectInertTargets(root);
  setPageInert(inertTargets, true);

  const pointer = {
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
  };

  let renderer = null;
  let animationFrame = 0;
  let entering = false;
  let enteringAt = 0;
  let completed = false;
  let completionTimer = 0;
  let clockTimer = 0;
  let wheelResetTimer = 0;
  let wheelAccumulator = 0;
  let hoverIndex = -1;
  let touchStartY = null;

  updateClock();
  clockTimer = window.setInterval(updateClock, 30000);
  installListeners();

  if (reduceMotion) {
    setStaticMode("REDUCED MOTION / READY");
  } else {
    initializeRenderer();
    animationFrame = window.requestAnimationFrame(render);
  }

  window.setTimeout(() => {
    if (!completed) {
      enterButtons[0].focus({ preventScroll: true });
    }
  }, 500);

  async function initializeRenderer() {
    try {
      if (!fallbackImage.complete) {
        await fallbackImage.decode();
      }

      if (completed) {
        return;
      }

      renderer = createWebGLRenderer(canvas, fallbackImage);
      if (!renderer) {
        setStaticMode("STATIC SCENE / READY");
        return;
      }

      root.dataset.renderer = "webgl";
      status.textContent = "WEBGL / READY";
      renderer.resize();
      canvas.classList.add("is-ready");
    } catch (error) {
      console.warn("WebGL intro could not be initialized:", error);
      renderer = null;
      setStaticMode("STATIC SCENE / READY");
    }
  }

  function installListeners() {
    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    root.addEventListener("pointerdown", handlePointerDown, { passive: true });
    root.addEventListener("pointerup", handlePointerUp, { passive: true });
    root.addEventListener("wheel", handleWheel, { passive: false });
    root.addEventListener("keydown", handleKeydown);
    skipButton.addEventListener("click", skipEntrance);
    enterButtons.forEach((button) => button.addEventListener("click", beginEntrance));

    [...enterButtons, skipButton].forEach((element) => {
      element.addEventListener("pointerenter", handleActionEnter);
      element.addEventListener("pointerleave", handleActionLeave);
    });
  }

  function render(now) {
    if (completed) {
      return;
    }

    pointer.currentX += (pointer.targetX - pointer.currentX) * 0.075;
    pointer.currentY += (pointer.targetY - pointer.currentY) * 0.075;

    let entranceProgress = 0;
    if (entering) {
      entranceProgress = Math.min((now - enteringAt) / 1380, 1);
      entranceProgress = easeInOutCubic(entranceProgress);
    }

    if (renderer) {
      renderer.draw(
        now * 0.001,
        pointer.currentX,
        pointer.currentY,
        entranceProgress,
        hoverIndex
      );
    }

    animationFrame = window.requestAnimationFrame(render);
  }

  function beginEntrance() {
    if (entering || completed) {
      return;
    }

    entering = true;
    enteringAt = performance.now();
    hoverIndex = -1;
    root.classList.remove("has-avatar-hover", "cursor-over-action");
    root.classList.add("is-entering");
    status.textContent = "OPENING / BLOG";
    disableActions();
    rememberIntro();

    completionTimer = window.setTimeout(
      () => completeEntrance(true),
      reduceMotion ? 240 : 1520
    );
  }

  function skipEntrance() {
    if (entering || completed) {
      return;
    }

    entering = true;
    hoverIndex = -1;
    root.classList.remove("has-avatar-hover", "cursor-over-action");
    root.classList.add("is-skipping");
    disableActions();
    rememberIntro();
    completionTimer = window.setTimeout(
      () => completeEntrance(true),
      reduceMotion ? 80 : 260
    );
  }

  function completeEntrance(moveFocus) {
    if (completed) {
      return;
    }

    completed = true;
    window.clearTimeout(completionTimer);
    window.clearTimeout(wheelResetTimer);
    window.clearInterval(clockTimer);
    window.cancelAnimationFrame(animationFrame);
    removeListeners();
    setPageInert(inertTargets, false);

    if (renderer) {
      renderer.destroy();
      renderer = null;
    }

    document.body.classList.remove("intro-active");
    html.classList.add("intro-seen");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;

    if (moveFocus) {
      const destination = document.querySelector(".hero .button");
      if (destination) {
        destination.focus({ preventScroll: true });
      }
    }
  }

  function removeListeners() {
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    root.removeEventListener("pointermove", handlePointerMove);
    root.removeEventListener("pointerleave", handlePointerLeave);
    root.removeEventListener("pointerdown", handlePointerDown);
    root.removeEventListener("pointerup", handlePointerUp);
    root.removeEventListener("wheel", handleWheel);
    root.removeEventListener("keydown", handleKeydown);
    skipButton.removeEventListener("click", skipEntrance);
    enterButtons.forEach((button) => button.removeEventListener("click", beginEntrance));

    [...enterButtons, skipButton].forEach((element) => {
      element.removeEventListener("pointerenter", handleActionEnter);
      element.removeEventListener("pointerleave", handleActionLeave);
    });
  }

  function rememberIntro() {
    try {
      window.sessionStorage.setItem(storageKey, "seen");
    } catch (error) {
      // The experience remains functional when storage is blocked.
    }
  }

  function disableActions() {
    enterButtons.forEach((button) => {
      button.disabled = true;
    });
    skipButton.disabled = true;
  }

  function setStaticMode(message) {
    root.dataset.renderer = "static";
    status.textContent = message;
  }

  function updateClock() {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    clock.textContent = `${formatter.format(new Date())}, KST · SEOUL`;
  }

  function handleResize() {
    if (renderer) {
      renderer.resize();
    }
  }

  function handleVisibilityChange() {
    if (completed || reduceMotion) {
      return;
    }

    window.cancelAnimationFrame(animationFrame);
    if (!document.hidden) {
      animationFrame = window.requestAnimationFrame(render);
    }
  }

  function handlePointerMove(event) {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);

    pointer.targetX = (event.clientX / width) * 2 - 1;
    pointer.targetY = 1 - (event.clientY / height) * 2;

    if (!coarsePointer && event.pointerType !== "touch") {
      root.classList.add("has-pointer");
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
      updateAvatarHover(event.clientX / width, event.clientY / height);
    }
  }

  function handlePointerLeave() {
    root.classList.remove("has-pointer", "has-avatar-hover");
    root.style.setProperty("--hover-strength", "0");
    hoverIndex = -1;
  }

  function handlePointerDown(event) {
    if (event.pointerType === "touch") {
      touchStartY = event.clientY;
    }
  }

  function handlePointerUp(event) {
    if (event.pointerType !== "touch" || touchStartY === null) {
      return;
    }

    const distance = touchStartY - event.clientY;
    touchStartY = null;
    if (distance > 46) {
      beginEntrance();
    }
  }

  function handleWheel(event) {
    if (entering || completed) {
      return;
    }

    event.preventDefault();
    wheelAccumulator = clamp(wheelAccumulator + event.deltaY, 0, 160);
    const progress = Math.round((wheelAccumulator / 160) * 100);
    status.textContent = progress > 8 ? `SCROLL / ${progress}%` : "WEBGL / READY";

    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => {
      wheelAccumulator = 0;
      status.textContent = renderer ? "WEBGL / READY" : "STATIC SCENE / READY";
    }, 700);

    if (wheelAccumulator >= 150) {
      beginEntrance();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      skipEntrance();
    }
  }

  function handleActionEnter() {
    root.classList.add("cursor-over-action");
  }

  function handleActionLeave() {
    root.classList.remove("cursor-over-action");
  }

  function updateAvatarHover(x, y) {
    if (entering || y < 0.13 || y > 0.9 || x < 0.29 || x > 0.75) {
      if (hoverIndex !== -1) {
        hoverIndex = -1;
        root.classList.remove("has-avatar-hover");
        root.style.setProperty("--hover-strength", "0");
        profile.setAttribute("aria-hidden", "true");
      }
      return;
    }

    const nextIndex = x < 0.43 ? 0 : x < 0.58 ? 1 : 2;
    if (nextIndex === hoverIndex) {
      return;
    }

    hoverIndex = nextIndex;
    const selected = profiles[nextIndex];
    profileIndex.textContent = selected.index;
    profileTitle.textContent = selected.title;
    profileDescription.textContent = selected.description;
    profile.style.left = selected.left;
    profile.setAttribute("aria-hidden", "false");
    root.style.setProperty("--accent-left", selected.accent);
    root.style.setProperty("--hover-strength", "0.72");
    root.classList.add("has-avatar-hover");
  }

  function createWebGLRenderer(targetCanvas, image) {
    const gl = targetCanvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    });

    if (!gl) {
      return null;
    }

    const vertexSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;

      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;

      varying vec2 vUv;
      uniform sampler2D uImage;
      uniform vec2 uResolution;
      uniform vec2 uPointer;
      uniform float uTime;
      uniform float uEntrance;
      uniform float uHover;
      uniform float uImageAspect;

      mat2 rotate2d(float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, -sine, sine, cosine);
      }

      float avatarZone(float x, float index) {
        float center = index < 0.5 ? 0.19 : index < 1.5 ? 0.51 : 0.82;
        return 1.0 - smoothstep(0.12, 0.27, abs(x - center));
      }

      void main() {
        vec2 resolution = max(uResolution, vec2(1.0));
        float aspect = resolution.x / resolution.y;
        float portrait = step(resolution.x, resolution.y);
        float entrance = uEntrance * uEntrance * (3.0 - 2.0 * uEntrance);
        float hoverActive = step(-0.5, uHover);

        vec2 point = vUv - 0.5;
        point.x *= aspect;
        point -= vec2(uPointer.x * 0.025, uPointer.y * 0.012) * (1.0 - entrance);
        point = rotate2d(uPointer.x * 0.025 + entrance * 0.095) * point;

        float imageHeight = mix(0.82, 0.62, portrait);
        imageHeight = mix(imageHeight, 1.28, entrance);
        float widthScale = mix(0.84, 1.0, portrait);
        vec2 imageUv = point / vec2(uImageAspect * imageHeight * widthScale, imageHeight) + 0.5;

        float inside =
          step(0.0, imageUv.x) *
          step(imageUv.x, 1.0) *
          step(0.0, imageUv.y) *
          step(imageUv.y, 1.0);

        if (inside < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }

        float motion = sin(imageUv.y * 19.0 + uTime * 1.35) * 0.0008;
        motion += sin(imageUv.y * 43.0 - uTime * 0.7) * 0.00035;
        motion *= 1.0 + hoverActive * 1.5 + entrance * 7.0;
        imageUv.x += motion;

        float split = 0.00045 + hoverActive * 0.0012 + entrance * 0.006;
        vec4 base = texture2D(uImage, imageUv);
        vec4 redSample = texture2D(uImage, imageUv + vec2(split, 0.0));
        vec4 blueSample = texture2D(uImage, imageUv - vec2(split, 0.0));
        float alpha = max(base.a, max(redSample.a, blueSample.a));

        vec3 color = vec3(redSample.r, base.g, blueSample.b);
        float zone = avatarZone(imageUv.x, max(uHover, 0.0)) * hoverActive;
        color *= 1.0 + zone * 0.09;

        vec2 pixel = 1.6 / resolution;
        float nearbyAlpha = max(
          max(texture2D(uImage, imageUv + vec2(pixel.x, 0.0)).a, texture2D(uImage, imageUv - vec2(pixel.x, 0.0)).a),
          max(texture2D(uImage, imageUv + vec2(0.0, pixel.y)).a, texture2D(uImage, imageUv - vec2(0.0, pixel.y)).a)
        );
        float edge = max(nearbyAlpha - base.a, 0.0) * zone;
        color = mix(color, vec3(1.0, 0.22, 0.02), edge * 0.85);

        float scanline = 0.985 + 0.015 * sin(gl_FragCoord.y * 0.9 + uTime * 2.0);
        color *= scanline;
        color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))) * vec3(0.2, 0.48, 1.0), entrance * 0.6);
        alpha *= inside;

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      if (vertexShader) {
        gl.deleteShader(vertexShader);
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("WebGL intro program could not be linked:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const entranceLocation = gl.getUniformLocation(program, "uEntrance");
    const hoverLocation = gl.getUniformLocation(program, "uHover");
    const imageAspectLocation = gl.getUniformLocation(program, "uImageAspect");
    const imageLocation = gl.getUniformLocation(program, "uImage");
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();

    if (!buffer || !texture || positionLocation < 0) {
      if (buffer) {
        gl.deleteBuffer(buffer);
      }
      if (texture) {
        gl.deleteTexture(texture);
      }
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(imageLocation, 0);
    gl.uniform1f(imageAspectLocation, image.naturalWidth / image.naturalHeight);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    function resize() {
      const mobile = window.innerWidth < 820;
      const maxPixelRatio = mobile ? 1 : 1.25;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
      const width = Math.max(Math.floor(window.innerWidth * pixelRatio), 1);
      const height = Math.max(Math.floor(window.innerHeight * pixelRatio), 1);

      if (targetCanvas.width !== width || targetCanvas.height !== height) {
        targetCanvas.width = width;
        targetCanvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }

    function draw(time, pointerX, pointerY, entranceProgress, activeHoverIndex) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(resolutionLocation, targetCanvas.width, targetCanvas.height);
      gl.uniform2f(pointerLocation, pointerX, pointerY);
      gl.uniform1f(timeLocation, time);
      gl.uniform1f(entranceLocation, entranceProgress);
      gl.uniform1f(hoverLocation, activeHoverIndex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function destroy() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      const loseContext = gl.getExtension("WEBGL_lose_context");
      if (loseContext) {
        loseContext.loseContext();
      }
    }

    return { draw, resize, destroy };
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("WebGL intro shader could not be compiled:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function collectInertTargets(intro) {
    const parent = intro.parentElement;
    if (!parent) {
      return [];
    }

    const outsideMain = Array.from(document.body.children).filter((element) => element !== parent);
    const insideMain = Array.from(parent.children).filter((element) => element !== intro);
    return [...outsideMain, ...insideMain].filter((element) => element instanceof HTMLElement);
  }

  function setPageInert(elements, value) {
    elements.forEach((element) => {
      element.inert = value;
    });
  }

  function easeInOutCubic(value) {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }
})();
