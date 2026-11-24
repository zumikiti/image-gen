/**
 * クリップボードへの書き込み。クライアントのコンポーネントから使う。
 */

/**
 * テキストをクリップボードへ書き込む。
 * navigator.clipboard は secure context(https / localhost)でしか使えず、
 * LAN の http で開いておると使えぬため、旧来の execCommand へ落とす。
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 権限拒否などはフォールバックへ回す
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

/**
 * 画像をクリップボードへ載せる。
 * ClipboardItem で画像を扱えるのは Chromium 系だけで、Firefox は未対応じゃ。
 * 対応していなければ false を返し、呼び出し側が別の手段を案内する。
 */
export async function copyImage(blob: Blob): Promise<boolean> {
  if (
    !window.isSecureContext ||
    !navigator.clipboard ||
    typeof ClipboardItem === "undefined"
  ) {
    return false;
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}
