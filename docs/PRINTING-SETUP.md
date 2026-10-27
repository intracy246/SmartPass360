# SmartPass360 Reception Printing Setup

## Visitor workflow

1. Connect a supported printer to the Reception/Security computer using USB, Bluetooth, or a supported network connection.
2. Install the printer driver or pair it in the operating system, then print a test page.
3. Set the intended printer as the operating-system default printer. For thermal printers, select the correct 80 mm paper/roll size in printer preferences.
4. Open SmartPass360 in Chrome on that same computer and allow pop-ups for the dashboard site.
5. In Visitor Queue, click **Approve & auto-print pass**. The app approves the pending visit, issues its pass, and automatically invokes the browser print function in the window reserved by that click.
6. Test several passes. The printed pass includes the QR code, visitor and organization details, validity, a return-to-Security notice in Kiswahili and English, and **SmartPass360 by SmartCycle360** branding.

## Silent printing on a dedicated Reception/Security computer

A normal website cannot silently send a print job to a physical printer because browsers protect users from unwanted printing. Without kiosk-printing mode, Chrome may show the print dialog. To print without an additional print-dialog confirmation, configure a dedicated, trusted Reception/Security workstation with Chrome/Chromium kiosk printing and a tested default printer.

### Windows

1. Pair/install the printer in Windows, select it as the default, and print a Windows test page.
2. Close all Chrome windows.
3. Create a dedicated Chrome shortcut. Its target should be the installed Chrome executable followed by these arguments:
   `--kiosk-printing https://smartpass.smartcycle360.com/visitors`

   Example:
   `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing https://smartpass.smartcycle360.com/visitors`

   Adjust the executable path if Chrome is installed elsewhere. The `--kiosk-printing` argument enables silent printing; it does not install, connect, or choose the printer for you.
4. Start Chrome using this shortcut, sign in to SmartPass360, and keep the dedicated session open. Test the complete **Approve & auto-print pass** workflow with a test visitor before production use.

### Linux

Install/pair the printer, set it as the OS default, and test it. Launch the dedicated browser with the flag (the browser executable can vary by distribution):

```bash
chromium --kiosk-printing https://smartpass.smartcycle360.com/visitors
```

Use the installed Chrome/Chromium command for your distribution. Sign in and test a sample pass.

## Important limitations and recovery

- USB, Bluetooth, and network printing are supported through the workstation operating system and printer driver; SmartPass360 does not itself pair with Bluetooth devices.
- Silent printing only works if the controlled browser session is launched with kiosk-printing mode and the intended printer is online, loaded with paper, and configured as default.
- If pop-ups are blocked, SmartPass360 cannot complete the approve-and-print flow; allow pop-ups and retry.
- If a pass is issued but paper does not print, check the printer/default-paper settings and use **Print ticket** in the issued-pass panel to retry. Avoid repeated clicks that could produce duplicate passes.
- Enable silent printing only on a physically controlled Reception/Security workstation, not on a personal or shared browsing device.
