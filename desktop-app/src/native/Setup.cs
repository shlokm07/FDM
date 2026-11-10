using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace ReaIdmSetup
{
    public class SetupProgram
    {
        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupWizardForm());
        }
    }

    public class SetupWizardForm : Form
    {
        private Panel termsPanel;
        private Panel installPanel;
        private TextBox termsTextBox;
        private CheckBox acceptTermsCheckBox;
        private Button nextButton;
        private Button backButton;
        private TextBox pathTextBox;
        private Button browseButton;
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button installButton;
        private Button cancelButton;
        private string installDir;
        private string sourceDir;

        private const string DEFAULT_TERMS =
            "FDM - FLUENT DOWNLOAD MANAGER\r\n" +
            "END-USER LICENSE AGREEMENT (EULA) AND TERMS OF USE\r\n" +
            "Version 3.0\r\n\r\n" +
            "PLEASE READ THIS USER AGREEMENT AND TERMS OF USE CAREFULLY BEFORE INSTALLING OR USING FDM - FLUENT DOWNLOAD MANAGER (\"THE SOFTWARE\"). BY CHECKING \"I ACCEPT\" AND INSTALLING THE SOFTWARE, YOU AGREE TO THESE TERMS.\r\n\r\n" +
            "1. GRANT OF LICENSE\r\n" +
            "FDM - Fluent Download Manager is provided for personal and commercial desktop download management on Windows. You may install and use the Software in accordance with these Terms.\r\n\r\n" +
            "2. LAWFUL USE & COPYRIGHT COMPLIANCE\r\n" +
            "- You are solely responsible for all URLs, files, and media downloaded using the Software.\r\n" +
            "- You agree to download only content you own, have permission to download, or that is legally permitted under applicable copyright laws and website terms.\r\n" +
            "- The Software does NOT crack or bypass DRM, hardware encryption, or access controls.\r\n\r\n" +
            "3. PRIVACY & LOCAL-ONLY OPERATION\r\n" +
            "- FDM operates strictly locally on 127.0.0.1 and sends zero personal analytics or browsing telemetry to external servers.\r\n" +
            "- Download history and settings are stored locally under your Windows user profile (%LOCALAPPDATA%).\r\n\r\n" +
            "4. OPTIONAL BROWSER EXTENSION & UNINSTALLATION\r\n" +
            "- Chrome/Edge extension integration is optional and enabled only with your consent.\r\n" +
            "- You can uninstall FDM cleanly at any time using Windows Settings -> Installed Apps, the Start Menu Uninstall shortcut, or Uninstall.exe in the install folder. Your downloaded files remain safe.\r\n\r\n" +
            "5. DISCLAIMER OF WARRANTIES\r\n" +
            "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.";

        public SetupWizardForm()
        {
            this.Text = "FDM - Fluent Download Manager Setup";
            this.Size = new Size(580, 450);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(17, 24, 39); // #111827
            this.ForeColor = Color.FromArgb(249, 250, 251);
            this.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            try { this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application; } catch { }

            sourceDir = AppDomain.CurrentDomain.BaseDirectory;
            installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\FDM");

            // Header Banner
            Panel headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 84;
            headerPanel.BackColor = Color.FromArgb(31, 41, 55); // #1F2937

            Label headerTitle = new Label();
            headerTitle.Text = "FDM - Fluent Download Manager";
            headerTitle.Font = new Font("Segoe UI", 15f, FontStyle.Bold);
            headerTitle.ForeColor = Color.FromArgb(249, 250, 251);
            headerTitle.Location = new Point(26, 15);
            headerTitle.AutoSize = true;

            Label headerSub = new Label();
            headerSub.Text = "Setup Wizard — Review Terms of Use & Installation Options";
            headerSub.Font = new Font("Segoe UI", 9.2f, FontStyle.Regular);
            headerSub.ForeColor = Color.FromArgb(129, 140, 248); // #818CF8
            headerSub.Location = new Point(27, 46);
            headerSub.AutoSize = true;

            Panel headerAccent = new Panel();
            headerAccent.Dock = DockStyle.Bottom;
            headerAccent.Height = 3;
            headerAccent.BackColor = Color.FromArgb(79, 70, 229); // #4F46E5

            headerPanel.Controls.Add(headerTitle);
            headerPanel.Controls.Add(headerSub);
            headerPanel.Controls.Add(headerAccent);
            this.Controls.Add(headerPanel);

            // Footer Panel for Navigation & Action Buttons
            Panel footerPanel = new Panel();
            footerPanel.Dock = DockStyle.Bottom;
            footerPanel.Height = 64;
            footerPanel.BackColor = Color.FromArgb(31, 41, 55);

            Panel footerDivider = new Panel();
            footerDivider.Dock = DockStyle.Top;
            footerDivider.Height = 1;
            footerDivider.BackColor = Color.FromArgb(55, 65, 81);
            footerPanel.Controls.Add(footerDivider);

            backButton = CreateStyledButton("< Back", 198, 14, 92, false);
            backButton.Visible = false;
            backButton.Click += (s, e) => ShowStep(1);
            footerPanel.Controls.Add(backButton);

            nextButton = CreateStyledButton("I Agree >", 302, 14, 118, true);
            nextButton.Enabled = false;
            nextButton.BackColor = Color.FromArgb(55, 65, 81);
            nextButton.Click += (s, e) => ShowStep(2);
            footerPanel.Controls.Add(nextButton);

            installButton = CreateStyledButton("Install", 302, 14, 118, true);
            installButton.Visible = false;
            installButton.Click += (s, e) => StartInstallation();
            footerPanel.Controls.Add(installButton);

            cancelButton = CreateStyledButton("Cancel", 434, 14, 96, false);
            cancelButton.Click += (s, e) => this.Close();
            footerPanel.Controls.Add(cancelButton);

            this.Controls.Add(footerPanel);

            // STEP 1 PANEL: User Agreement & Terms of Use
            termsPanel = new Panel();
            termsPanel.Location = new Point(0, 84);
            termsPanel.Size = new Size(574, 270);
            termsPanel.BackColor = Color.FromArgb(17, 24, 39);

            Label termsHeading = new Label();
            termsHeading.Text = "User Agreement & Terms of Use";
            termsHeading.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            termsHeading.ForeColor = Color.FromArgb(249, 250, 251);
            termsHeading.Location = new Point(26, 16);
            termsHeading.AutoSize = true;
            termsPanel.Controls.Add(termsHeading);

            termsTextBox = new TextBox();
            termsTextBox.Multiline = true;
            termsTextBox.ReadOnly = true;
            termsTextBox.ScrollBars = ScrollBars.Vertical;
            termsTextBox.BackColor = Color.FromArgb(36, 47, 64);
            termsTextBox.ForeColor = Color.FromArgb(229, 231, 235);
            termsTextBox.BorderStyle = BorderStyle.FixedSingle;
            termsTextBox.Font = new Font("Segoe UI", 8.8f, FontStyle.Regular);
            termsTextBox.Location = new Point(26, 42);
            termsTextBox.Size = new Size(508, 178);
            termsTextBox.Text = LoadTermsText();
            termsTextBox.SelectionStart = 0;
            termsTextBox.SelectionLength = 0;
            termsPanel.Controls.Add(termsTextBox);

            acceptTermsCheckBox = new CheckBox();
            acceptTermsCheckBox.Text = "I accept the User Agreement and Terms of Use";
            acceptTermsCheckBox.Font = new Font("Segoe UI", 9.2f, FontStyle.Bold);
            acceptTermsCheckBox.ForeColor = Color.FromArgb(249, 250, 251);
            acceptTermsCheckBox.Location = new Point(26, 232);
            acceptTermsCheckBox.AutoSize = true;
            acceptTermsCheckBox.Cursor = Cursors.Hand;
            acceptTermsCheckBox.CheckedChanged += (s, e) =>
            {
                nextButton.Enabled = acceptTermsCheckBox.Checked;
                nextButton.BackColor = acceptTermsCheckBox.Checked
                    ? Color.FromArgb(79, 70, 229)
                    : Color.FromArgb(55, 65, 81);
            };
            termsPanel.Controls.Add(acceptTermsCheckBox);

            this.Controls.Add(termsPanel);

            // STEP 2 PANEL: Destination Folder & Progress
            installPanel = new Panel();
            installPanel.Location = new Point(0, 84);
            installPanel.Size = new Size(574, 270);
            installPanel.BackColor = Color.FromArgb(17, 24, 39);
            installPanel.Visible = false;

            Label destHeaderLabel = new Label();
            destHeaderLabel.Text = "Destination Folder";
            destHeaderLabel.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            destHeaderLabel.ForeColor = Color.FromArgb(249, 250, 251);
            destHeaderLabel.Location = new Point(26, 20);
            destHeaderLabel.AutoSize = true;
            installPanel.Controls.Add(destHeaderLabel);

            Label destDescLabel = new Label();
            destDescLabel.Text = "Setup will install FDM - Fluent Download Manager into the directory below. Click Browse to customize.";
            destDescLabel.Font = new Font("Segoe UI", 8.8f, FontStyle.Regular);
            destDescLabel.ForeColor = Color.FromArgb(156, 163, 175);
            destDescLabel.Location = new Point(26, 44);
            destDescLabel.Size = new Size(508, 20);
            installPanel.Controls.Add(destDescLabel);

            pathTextBox = new TextBox();
            pathTextBox.Text = installDir;
            pathTextBox.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            pathTextBox.ForeColor = Color.FromArgb(249, 250, 251);
            pathTextBox.BackColor = Color.FromArgb(36, 47, 64);
            pathTextBox.BorderStyle = BorderStyle.FixedSingle;
            pathTextBox.Location = new Point(26, 72);
            pathTextBox.Size = new Size(408, 26);
            pathTextBox.TextChanged += (s, e) => installDir = pathTextBox.Text.Trim();
            installPanel.Controls.Add(pathTextBox);

            browseButton = CreateStyledButton("Browse...", 442, 71, 92, false);
            browseButton.Height = 28;
            browseButton.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Select Destination Folder for FDM - Fluent Download Manager";
                    fbd.SelectedPath = pathTextBox.Text;
                    fbd.ShowNewFolderButton = true;
                    if (fbd.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(fbd.SelectedPath))
                    {
                        pathTextBox.Text = fbd.SelectedPath;
                        installDir = fbd.SelectedPath;
                    }
                }
            };
            installPanel.Controls.Add(browseButton);

            Label spaceLabel = new Label();
            spaceLabel.Text = "Space required: ~90 MB  |  Includes Windows Uninstaller & Terms of Use";
            spaceLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            spaceLabel.ForeColor = Color.FromArgb(107, 114, 128);
            spaceLabel.Location = new Point(26, 110);
            spaceLabel.AutoSize = true;
            installPanel.Controls.Add(spaceLabel);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(26, 152);
            progressBar.Size = new Size(508, 16);
            progressBar.Style = ProgressBarStyle.Continuous;
            installPanel.Controls.Add(progressBar);

            statusLabel = new Label();
            statusLabel.Text = "Ready to install. Click 'Install' to begin.";
            statusLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(156, 163, 175);
            statusLabel.Location = new Point(26, 178);
            statusLabel.Size = new Size(508, 22);
            installPanel.Controls.Add(statusLabel);

            this.Controls.Add(installPanel);
        }

        private string LoadTermsText()
        {
            try
            {
                string termsPath = Path.Combine(sourceDir, "TERMS_OF_USE.txt");
                if (File.Exists(termsPath))
                {
                    return File.ReadAllText(termsPath).Replace("\r\n", "\n").Replace("\n", "\r\n");
                }
            }
            catch { }
            return DEFAULT_TERMS;
        }

        private Button CreateStyledButton(string text, int x, int y, int width, bool primary)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Location = new Point(x, y);
            btn.Size = new Size(width, 36);
            btn.Font = new Font("Segoe UI", 9.3f, primary ? FontStyle.Bold : FontStyle.Regular);
            btn.BackColor = primary ? Color.FromArgb(79, 70, 229) : Color.FromArgb(36, 47, 64);
            btn.ForeColor = primary ? Color.White : Color.FromArgb(249, 250, 251);
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderSize = primary ? 0 : 1;
            btn.FlatAppearance.BorderColor = Color.FromArgb(55, 65, 81);
            btn.Cursor = Cursors.Hand;
            if (!primary)
            {
                btn.MouseEnter += (s, e) => btn.BackColor = Color.FromArgb(45, 58, 78);
                btn.MouseLeave += (s, e) => btn.BackColor = Color.FromArgb(36, 47, 64);
            }
            return btn;
        }

        private void ShowStep(int step)
        {
            bool isTerms = (step == 1);
            termsPanel.Visible = isTerms;
            installPanel.Visible = !isTerms;
            nextButton.Visible = isTerms;
            backButton.Visible = !isTerms;
            installButton.Visible = !isTerms;
        }

        private void StartInstallation()
        {
            installDir = pathTextBox.Text.Trim();
            if (string.IsNullOrEmpty(installDir))
            {
                MessageBox.Show("Please choose a valid destination folder.", "Invalid Path", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            installButton.Enabled = false;
            backButton.Enabled = false;
            cancelButton.Enabled = false;
            pathTextBox.Enabled = false;
            browseButton.Enabled = false;

            Thread worker = new Thread(() =>
            {
                try
                {
                    UpdateStatus("Creating installation directory...", 15);
                    Directory.CreateDirectory(installDir);
                    Directory.CreateDirectory(Path.Combine(installDir, "ui"));
                    Directory.CreateDirectory(Path.Combine(installDir, "extension"));

                    UpdateStatus("Installing application binaries & uninstaller...", 35);
                    CopyBinary("REA-IDM.exe");
                    CopyBinary("rea-idm-core.exe");
                    CopyBinary("Uninstall.exe");
                    CopyBinary("Microsoft.Web.WebView2.Core.dll");
                    CopyBinary("Microsoft.Web.WebView2.WinForms.dll");
                    CopyBinary("WebView2Loader.dll");

                    string termsSrc = Path.Combine(sourceDir, "TERMS_OF_USE.txt");
                    if (File.Exists(termsSrc))
                    {
                        File.Copy(termsSrc, Path.Combine(installDir, "TERMS_OF_USE.txt"), true);
                    }
                    else
                    {
                        File.WriteAllText(Path.Combine(installDir, "TERMS_OF_USE.txt"), DEFAULT_TERMS);
                    }

                    UpdateStatus("Unloading UI assets...", 55);
                    string uiSrc = Path.Combine(sourceDir, @"desktop-app\bin\ui");
                    if (!Directory.Exists(uiSrc)) uiSrc = Path.Combine(sourceDir, "ui");
                    if (Directory.Exists(uiSrc))
                    {
                        CopyDirectory(uiSrc, Path.Combine(installDir, "ui"));
                    }

                    UpdateStatus("Installing browser extension package...", 70);
                    string extSrc = Path.Combine(sourceDir, "chrome-extension");
                    if (!Directory.Exists(extSrc)) extSrc = Path.Combine(sourceDir, @"desktop-app\bin\extension");
                    if (Directory.Exists(extSrc))
                    {
                        CopyDirectory(extSrc, Path.Combine(installDir, "extension"));
                    }

                    UpdateStatus("Registering Chrome, Edge & Windows Uninstall keys...", 85);
                    RegisterNativeHostAndUninstall();

                    UpdateStatus("Creating Desktop & Start Menu shortcuts...", 95);
                    CreateShortcuts();

                    UpdateStatus("Installation Complete!", 100);

                    this.Invoke((MethodInvoker)delegate
                    {
                        PromptExtensionInstall();

                        string targetApp = Path.Combine(installDir, "REA-IDM.exe");
                        if (File.Exists(targetApp))
                        {
                            Process.Start(targetApp);
                        }

                        this.Close();
                    });
                }
                catch (Exception ex)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show("Installation Error: " + ex.Message, "FDM - Fluent Download Manager Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        installButton.Enabled = true;
                        backButton.Enabled = true;
                        cancelButton.Enabled = true;
                        pathTextBox.Enabled = true;
                        browseButton.Enabled = true;
                    });
                }
            });

            worker.IsBackground = true;
            worker.Start();
        }

        private void CopyBinary(string fileName)
        {
            string src = Path.Combine(sourceDir, @"desktop-app\bin\" + fileName);
            if (!File.Exists(src)) src = Path.Combine(sourceDir, fileName);
            if (File.Exists(src))
            {
                File.Copy(src, Path.Combine(installDir, fileName), true);
            }
        }

        private void UpdateStatus(string message, int progress)
        {
            this.Invoke((MethodInvoker)delegate
            {
                statusLabel.Text = message;
                progressBar.Value = Math.Min(100, progress);
            });
            Thread.Sleep(120);
        }

        private void CopyDirectory(string sourcePath, string destPath)
        {
            Directory.CreateDirectory(destPath);
            foreach (string file in Directory.GetFiles(sourcePath))
            {
                File.Copy(file, Path.Combine(destPath, Path.GetFileName(file)), true);
            }
            foreach (string dir in Directory.GetDirectories(sourcePath))
            {
                CopyDirectory(dir, Path.Combine(destPath, Path.GetFileName(dir)));
            }
        }

        private void RegisterNativeHostAndUninstall()
        {
            try
            {
                string manifestPath = Path.Combine(installDir, "com.rea.idm.json");
                string coreExe = Path.Combine(installDir, "rea-idm-core.exe");

                string manifestContent = "{\n" +
                    "  \"name\": \"com.rea.idm\",\n" +
                    "  \"description\": \"FDM - Fluent Download Manager Native Messaging Host\",\n" +
                    "  \"path\": \"" + coreExe.Replace(@"\", @"\\") + "\",\n" +
                    "  \"type\": \"stdio\",\n" +
                    "  \"allowed_origins\": [\"chrome-extension://*/*\"]\n" +
                    "}";

                File.WriteAllText(manifestPath, manifestContent);

                using (RegistryKey chromeKey = Registry.CurrentUser.CreateSubKey(@"Software\Google\Chrome\NativeMessagingHosts\com.rea.idm"))
                {
                    if (chromeKey != null) chromeKey.SetValue("", manifestPath);
                }

                using (RegistryKey edgeKey = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Edge\NativeMessagingHosts\com.rea.idm"))
                {
                    if (edgeKey != null) edgeKey.SetValue("", manifestPath);
                }

                // Autostart on boot
                string mainExe = Path.Combine(installDir, "REA-IDM.exe");
                using (RegistryKey runKey = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
                {
                    if (runKey != null) runKey.SetValue("FDM - Fluent Download Manager", "\"" + mainExe + "\"");
                }

                // Windows Installed Apps (Add/Remove Programs) Registration
                string uninstallExe = Path.Combine(installDir, "Uninstall.exe");
                using (RegistryKey uninstKey = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\FDM-FluentDownloadManager"))
                {
                    if (uninstKey != null)
                    {
                        uninstKey.SetValue("DisplayName", "FDM - Fluent Download Manager");
                        uninstKey.SetValue("DisplayVersion", "3.0.0");
                        uninstKey.SetValue("Publisher", "FDM - Fluent Download Manager");
                        uninstKey.SetValue("DisplayIcon", mainExe);
                        uninstKey.SetValue("InstallLocation", installDir);
                        uninstKey.SetValue("UninstallString", "\"" + uninstallExe + "\"");
                        uninstKey.SetValue("EstimatedSize", 86000, RegistryValueKind.DWord);
                        uninstKey.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        uninstKey.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }

        private void CreateShortcuts()
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    string targetExe = Path.Combine(installDir, "REA-IDM.exe");
                    string uninstallExe = Path.Combine(installDir, "Uninstall.exe");

                    // Desktop Shortcut
                    string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    dynamic shortcutDesk = shell.CreateShortcut(Path.Combine(desktop, "FDM - Fluent Download Manager.lnk"));
                    shortcutDesk.TargetPath = targetExe;
                    shortcutDesk.Description = "FDM - Fluent Download Manager";
                    shortcutDesk.Save();

                    // Start Menu Shortcuts (App + Uninstall)
                    string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "FDM - Fluent Download Manager");
                    Directory.CreateDirectory(startMenu);

                    dynamic shortcutMenu = shell.CreateShortcut(Path.Combine(startMenu, "FDM - Fluent Download Manager.lnk"));
                    shortcutMenu.TargetPath = targetExe;
                    shortcutMenu.Save();

                    if (File.Exists(uninstallExe))
                    {
                        dynamic shortcutUninst = shell.CreateShortcut(Path.Combine(startMenu, "Uninstall FDM.lnk"));
                        shortcutUninst.TargetPath = uninstallExe;
                        shortcutUninst.Description = "Uninstall FDM - Fluent Download Manager";
                        shortcutUninst.Save();
                    }
                }
            }
            catch { }
        }

        private void PromptExtensionInstall()
        {
            DialogResult result = MessageBox.Show(
                "Would you like to install the FDM - Fluent Download Manager Chrome & Edge Extension to automatically capture downloads and video streams in your browser?",
                "FDM - Fluent Download Manager Extension",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );

            if (result == DialogResult.Yes)
            {
                string extFolder = Path.Combine(installDir, "extension");

                try
                {
                    Process.Start("chrome.exe", "chrome://extensions/");
                }
                catch
                {
                    try { Process.Start("msedge.exe", "edge://extensions/"); } catch { }
                }

                Process.Start("explorer.exe", extFolder);

                MessageBox.Show(
                    "To finish adding the extension:\n\n1. In your browser (chrome://extensions), toggle on 'Developer mode' (top right).\n2. Click 'Load unpacked' and select the folder currently open in Explorer:\n   " + extFolder + "\n\nFDM - Fluent Download Manager will now automatically intercept browser downloads!",
                    "How to Enable Extension",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
        }
    }
}
