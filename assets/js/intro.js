(() => {
  "use strict";

  const root = document.getElementById("webgl-intro");
  const canvas = document.getElementById("webgl-intro-canvas");
  const enterButton = document.getElementById("webgl-intro-enter");
  const skipButton = document.getElementById("webgl-intro-skip");
  const status = document.getElementById("webgl-intro-status");
  const cursor = document.getElementById("webgl-intro-cursor");

  if (!root || !canvas || !enterButton || !skipButton || !status || !cursor) {
    return;
  }

  const storageKey = "klm4416:intro:v1";
  const html = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const currentUrl = new URL(window.location.href);
  const replayRequested = currentUrl.searchParams.get("intro") === "1";

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

  if (reduceMotion) {
    setStaticMode();
  } else {
    try {
      renderer = createWebGLRenderer(canvas);
    } catch (error) {
      console.warn("WebGL intro could not be initialized:", error);
      renderer = null;
    }

    if (renderer) {
      root.dataset.renderer = "webgl";
      status.textContent = "GPU RENDER / READY";
      canvas.classList.add("is-ready");
      renderer.resize();
      animationFrame = window.requestAnimationFrame(render);
    } else {
      setStaticMode();
    }
  }

  window.addEventListener("resize", handleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  root.addEventListener("pointermove", handlePointerMove, { passive: true });
  root.addEventListener("pointerleave", handlePointerLeave, { passive: true });
  root.addEventListener("keydown", handleKeydown);
  enterButton.addEventListener("click", beginEntrance);
  skipButton.addEventListener("click", skipEntrance);

  [enterButton, skipButton].forEach((element) => {
    element.addEventListener("pointerenter", () => root.classList.add("cursor-over-action"));
    element.addEventListener("pointerleave", () => root.classList.remove("cursor-over-action"));
  });

  window.setTimeout(() => {
    if (!completed) {
      enterButton.focus({ preventScroll: true });
    }
  }, 400);

  function render(now) {
    if (completed || !renderer) {
      return;
    }

    pointer.currentX += (pointer.targetX - pointer.currentX) * 0.065;
    pointer.currentY += (pointer.targetY - pointer.currentY) * 0.065;

    let entranceProgress = 0;
    if (entering) {
      entranceProgress = Math.min((now - enteringAt) / 1350, 1);
      entranceProgress = easeInOutCubic(entranceProgress);
    }

    renderer.draw(now * 0.001, pointer.currentX, pointer.currentY, entranceProgress);
    animationFrame = window.requestAnimationFrame(render);
  }

  function beginEntrance() {
    if (entering || completed) {
      return;
    }

    entering = true;
    enteringAt = performance.now();
    root.classList.add("is-entering");
    root.classList.remove("cursor-over-action");
    status.textContent = "ENTERING / ARCHIVE";
    disableActions();
    rememberIntro();

    const duration = reduceMotion ? 260 : 1450;
    completionTimer = window.setTimeout(() => completeEntrance(true), duration);
  }

  function skipEntrance() {
    if (entering || completed) {
      return;
    }

    entering = true;
    root.classList.add("is-skipping");
    root.classList.remove("cursor-over-action");
    disableActions();
    rememberIntro();
    completionTimer = window.setTimeout(() => completeEntrance(true), reduceMotion ? 80 : 300);
  }

  function completeEntrance(moveFocus) {
    if (completed) {
      return;
    }

    completed = true;
    window.clearTimeout(completionTimer);
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  function rememberIntro() {
    try {
      window.sessionStorage.setItem(storageKey, "seen");
    } catch (error) {
      // The experience remains functional when storage is blocked.
    }
  }

  function disableActions() {
    enterButton.disabled = true;
    skipButton.disabled = true;
  }

  function setStaticMode() {
    root.dataset.renderer = "static";
    status.textContent = reduceMotion ? "REDUCED MOTION / READY" : "STATIC FIELD / READY";
  }

  function handleResize() {
    if (renderer) {
      renderer.resize();
    }
  }

  function handleVisibilityChange() {
    if (!renderer || completed) {
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
    }
  }

  function handlePointerLeave() {
    root.classList.remove("has-pointer");
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      skipEntrance();
    }
  }

  function createWebGLRenderer(targetCanvas) {
    const gl = targetCanvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    });

    if (!gl) {
      return null;
    }

    const vertexSource = `
      attribute vec2 aPosition;

      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;

      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uPointer;
      uniform float uEntrance;

      const float PI = 3.14159265359;

      mat2 rotate2d(float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, -sine, sine, cosine);
      }

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 456.21));
        point += dot(point, point + 45.32);
        return fract(point.x * point.y);
      }

      float starField(vec2 point, float time) {
        float field = 0.0;

        for (int index = 0; index < 4; index++) {
          float layer = float(index);
          float scale = 7.0 + layer * 5.5;
          vec2 rotated = rotate2d(time * (0.008 + layer * 0.003)) * point;
          vec2 grid = rotated * scale + layer * 13.7;
          vec2 cell = floor(grid);
          vec2 local = fract(grid) - 0.5;
          float seed = hash21(cell + layer * 31.9);
          vec2 offset = vec2(
            hash21(cell + layer + 7.1),
            hash21(cell + layer + 19.7)
          ) - 0.5;
          float distanceToStar = length(local - offset * 0.72);
          float star = 1.0 - smoothstep(0.0, 0.038 + layer * 0.004, distanceToStar);
          float twinkle = 0.58 + 0.42 * sin(time * (1.1 + seed * 2.4) + seed * 18.0);
          field += star * step(0.79, seed) * twinkle / (1.0 + layer * 0.45);
        }

        return field;
      }

      float torusDistance(vec3 point, vec2 radii) {
        vec2 torus = vec2(length(point.xy) - radii.x, point.z);
        return length(torus) - radii.y;
      }

      float sceneDistance(vec3 point) {
        point.xz = rotate2d(uTime * 0.17 + uPointer.x * 0.24) * point.xz;
        point.yz = rotate2d(uTime * 0.11 - uPointer.y * 0.2) * point.yz;

        float angle = atan(point.y, point.x);
        float ripple = sin(angle * 8.0 + point.z * 5.5 - uTime * 1.35) * 0.024;
        ripple += sin(angle * 3.0 - uTime * 0.7) * 0.012;

        return torusDistance(point, vec2(0.8, 0.17 + ripple));
      }

      vec3 sceneNormal(vec3 point) {
        vec2 epsilon = vec2(0.0025, 0.0);
        return normalize(vec3(
          sceneDistance(point + epsilon.xyy) - sceneDistance(point - epsilon.xyy),
          sceneDistance(point + epsilon.yxy) - sceneDistance(point - epsilon.yxy),
          sceneDistance(point + epsilon.yyx) - sceneDistance(point - epsilon.yyx)
        ));
      }

      vec2 marchScene(vec3 origin, vec3 direction) {
        float travel = 0.0;
        float glow = 0.0;

        for (int stepIndex = 0; stepIndex < 52; stepIndex++) {
          vec3 point = origin + direction * travel;
          float distanceToSurface = sceneDistance(point);
          glow += exp(-20.0 * abs(distanceToSurface)) * 0.012;

          if (distanceToSurface < 0.0015 || travel > 6.0) {
            break;
          }

          travel += max(distanceToSurface * 0.72, 0.004);
        }

        return vec2(travel, glow);
      }

      void main() {
        vec2 resolution = max(uResolution, vec2(1.0));
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float entrance = uEntrance * uEntrance * (3.0 - 2.0 * uEntrance);

        uv += uPointer * 0.035 * (1.0 - min(length(uv) * 0.35, 1.0));

        float radius = length(uv);
        float angle = atan(uv.y, uv.x);
        vec3 violet = vec3(0.43, 0.28, 1.0);
        vec3 blue = vec3(0.02, 0.58, 1.0);
        vec3 color = mix(vec3(0.006, 0.006, 0.015), vec3(0.018, 0.012, 0.055), uv.y * 0.24 + 0.5);

        float stars = starField(uv * mix(1.0, 2.4, entrance), uTime + entrance * 7.0);
        color += mix(violet, blue, radius) * stars * (0.55 + entrance * 0.9);

        float orbitalRing = exp(-17.0 * abs(radius - 0.53));
        float orbitalBands = 0.5 + 0.5 * sin(angle * 12.0 - radius * 19.0 + uTime * 1.2);
        color += mix(violet, blue, orbitalBands) * orbitalRing * orbitalBands * 0.12;

        vec3 cameraOrigin = vec3(
          uPointer.x * 0.1,
          uPointer.y * 0.07,
          mix(2.75, 0.24, entrance)
        );
        vec3 rayDirection = normalize(vec3(uv * mix(0.82, 1.18, entrance), -1.72));
        vec2 march = marchScene(cameraOrigin, rayDirection);

        color += mix(violet, blue, 0.5 + 0.5 * sin(angle + uTime)) * march.y * 0.48;

        if (march.x < 6.0) {
          vec3 surfacePoint = cameraOrigin + rayDirection * march.x;
          float surfaceCheck = abs(sceneDistance(surfacePoint));

          if (surfaceCheck < 0.018) {
            vec3 normal = sceneNormal(surfacePoint);
            vec3 lightDirection = normalize(vec3(-0.45, 0.72, 0.9));
            float diffuse = max(dot(normal, lightDirection), 0.0);
            float fresnel = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.4);
            float specular = pow(max(dot(reflect(-lightDirection, normal), -rayDirection), 0.0), 28.0);
            float paletteShift = 0.5 + 0.5 * sin(surfacePoint.y * 4.0 + surfacePoint.x * 2.0 + uTime);
            vec3 surfaceColor = mix(violet, blue, paletteShift);

            color += surfaceColor * (0.2 + diffuse * 0.48 + fresnel * 1.7);
            color += vec3(0.82, 0.88, 1.0) * specular * 1.5;
          }
        }

        float centerMask = smoothstep(0.08, 0.34, radius);
        color *= mix(0.3, 1.0, centerMask);

        float radialLines = pow(max(0.0, sin(angle * 54.0 + uTime * 2.0)), 18.0);
        radialLines *= 1.0 - smoothstep(0.15, 1.4, radius);
        color += mix(violet, blue, radius) * radialLines * pow(entrance, 3.0) * 0.7;
        color += mix(violet, vec3(0.75, 0.88, 1.0), 0.55) * pow(entrance, 8.0) * 1.25;

        float vignette = 1.0 - smoothstep(0.45, 1.55, radius) * 0.72;
        color *= mix(vignette, 1.0, entrance * 0.7);
        color = 1.0 - exp(-color * 1.2);
        color = pow(color, vec3(0.4545));

        gl_FragColor = vec4(color, 1.0);
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
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const entranceLocation = gl.getUniformLocation(program, "uEntrance");
    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    function resize() {
      const mobile = window.innerWidth < 760;
      const maxPixelRatio = mobile ? 1 : 1.5;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
      const width = Math.max(Math.floor(window.innerWidth * pixelRatio), 1);
      const height = Math.max(Math.floor(window.innerHeight * pixelRatio), 1);

      if (targetCanvas.width !== width || targetCanvas.height !== height) {
        targetCanvas.width = width;
        targetCanvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }

    function draw(time, pointerX, pointerY, entranceProgress) {
      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, targetCanvas.width, targetCanvas.height);
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(pointerLocation, pointerX, pointerY);
      gl.uniform1f(entranceLocation, entranceProgress);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function destroy() {
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
})();
