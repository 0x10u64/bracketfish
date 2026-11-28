document.addEventListener("DOMContentLoaded", () => {
  const threadId = window.location.pathname.split("/")[2] || null;

  let reloadPage = async () => {
    const response = await fetch(window.location.href, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Reload failed: ${response.status}`);
    }

    const doc = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );

    const postsDiv = doc.getElementById("posts");
    if (!(postsDiv instanceof HTMLDivElement)) {
      throw new Error("No posts element in response");
    }

    const currentPostsDiv = document.getElementById("posts");
    if (!(currentPostsDiv instanceof HTMLDivElement)) {
      throw new Error("No posts element in current page");
    }

    const existingPostIds = new Set(
      Array.from(currentPostsDiv.querySelectorAll(".post"), (post) => post.id),
    );
    const separatorTag = threadId ? "br" : "hr";

    postsDiv.querySelectorAll(".post").forEach((post) => {
      if (existingPostIds.has(post.id)) {
        return;
      }

      if (existingPostIds.size > 0) {
        currentPostsDiv.append(document.createElement(separatorTag));
      }

      currentPostsDiv.append(document.importNode(post, true));
      existingPostIds.add(post.id);
    });
  };

  /**
   * @template {Element} T
   * @param {string} id
   * @param {new (...args: any[]) => T} type
   */
  const queryElement = (id, type) => {
    const el = document.getElementById(id);
    if (!(el instanceof type)) {
      throw new Error(`Expected ${type} for #${id}`);
    }
    return el;
  };

  const postForm = queryElement("postForm", HTMLFormElement);
  const postFormContent = queryElement("postFormContent", HTMLTextAreaElement);
  const postFormSubmit = queryElement("postFormSubmit", HTMLInputElement);
  const emojiPicker = queryElement("emojiPicker", HTMLDivElement);
  const reloadAnchor = queryElement("reloadAnchor", HTMLAnchorElement);
  const autoReloadInput = queryElement("autoReloadInput", HTMLInputElement);
  const autoReloadSpan = queryElement("autoReloadSpan", HTMLSpanElement);

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const anchor = event.target.closest('.post a[href^="#p"]');
    if (anchor instanceof HTMLAnchorElement) {
      const href = anchor.getAttribute("href");
      if (href && /^#p[0-9a-f]{8}$/.test(href)) {
        document.querySelectorAll(".highlight").forEach((el) => {
          el.classList.remove("highlight");
        });

        const targetPost = document.getElementById(href.slice(1));
        if (targetPost instanceof HTMLDivElement) {
          targetPost.classList.add("highlight");
          setTimeout(() => targetPost.classList.remove("highlight"), 5000);
        }
      }
    }

    const image = event.target.closest(".post > img");
    if (image instanceof HTMLImageElement) {
      image.classList.toggle("expanded");
    }

    const replyAnchor = event.target.closest('.post > div > a[href="#"]');
    if (replyAnchor instanceof HTMLAnchorElement) {
      event.preventDefault();

      const post = replyAnchor.closest(".post");
      if (!(post instanceof HTMLDivElement)) {
        return;
      }

      postFormContent.focus();
      postFormContent.value += `>>${post.id.slice(1)}\n`;
    }
  });

  emojiPicker.querySelectorAll("button[data-emoji]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button instanceof HTMLElement) {
        const emoji = button.dataset.emoji;
        if (emoji) {
          postFormContent.value += `[${emoji}]`;
        }
      }
    });
  });

  postForm.reset();
  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    postFormSubmit.disabled = true;

    try {
      const formData = new FormData(postForm);
      if (threadId) {
        formData.set("thread", threadId);
      }

      const response = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create post");
      }

      reloadPage();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unknown post error",
      );
      console.error(error);
      postFormSubmit.disabled = false;
    }
  });

  reloadAnchor.addEventListener("click", (event) => {
    event.preventDefault();
    reloadPage();
  });

  /** @type {ReturnType<typeof setInterval> | undefined} */
  let autoReloadTimer;
  let autoReloadTicks = 0;

  const autoReloadTick = async () => {
    const elapsed = autoReloadTicks / 10;
    autoReloadTicks++;

    if (elapsed < 5) {
      autoReloadSpan.textContent = `Reloading in ${(5 - elapsed).toFixed(1)}...`;
    } else if (elapsed == 5) {
      autoReloadSpan.textContent = "Reloading...";
      await reloadPage();
    } else if (elapsed >= 7) {
      clearInterval(autoReloadTimer);
      startAutoReload();
    }
  };

  const startAutoReload = () => {
    clearInterval(autoReloadTimer);

    autoReloadTicks = 0;
    if (!autoReloadInput.checked) {
      autoReloadSpan.textContent = "Auto reloading disabled";
      return;
    }

    autoReloadTick();
    autoReloadTimer = setInterval(autoReloadTick, 100);
  };

  autoReloadInput.addEventListener("change", startAutoReload);
  startAutoReload();
});
