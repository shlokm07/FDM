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
        private TextBox pathTextBox;
        private Button browseButton;
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button installButton;
        private Button cancelButton;
        private string installDir;
        private string sourceDir;

        public SetupWizardForm()
        {
            this.Text = "REA-IDM Setup — Installation Wizard";
            this.Size = new Size(560, 420);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(17, 19, 23); // Obsidian Canvas
            this.ForeColor = Color.FromArgb(243, 244, 246);
            this.Font = new Font("Segoe UI", 9f, FontStyle.Regular);

            sourceDir = AppDomain.CurrentDomain.BaseDirectory;
            installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\REA-IDM");

            // Header Banner
            Panel headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 88;
            headerPanel.BackColor = Color.FromArgb(24, 27, 32);

            Label headerTitle = new Label();
            headerTitle.Text = "REA-IDM Setup Wizard";
            headerTitle.Font = new Font("Segoe UI", 15.5f, FontStyle.Bold);
            headerTitle.ForeColor = Color.FromArgb(243, 244, 246);
            headerTitle.Location = new Point(26, 16);
            headerTitle.AutoSize = true;

            Label headerSub = new Label();
            headerSub.Text = "Ultra-Lightweight Multi-Threaded Download Manager";
            headerSub.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            headerSub.ForeColor = Color.FromArgb(52, 211, 153); // Mint Accent
            headerSub.Location = new Point(27, 48);
            headerSub.AutoSize = true;

            // Emerald accent bottom line on header
            Panel headerAccent = new Panel();
            headerAccent.Dock = DockStyle.Bottom;
            headerAccent.Height = 3;
            headerAccent.BackColor = Color.FromArgb(16, 185, 129);

            headerPanel.Controls.Add(headerTitle);
            headerPanel.Controls.Add(headerSub);
            headerPanel.Controls.Add(headerAccent);
            this.Controls.Add(headerPanel);

            // Destination Folder Section
            Label destHeaderLabel = new Label();
            destHeaderLabel.Text = "Destination Folder";
            destHeaderLabel.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            destHeaderLabel.ForeColor = Color.FromArgb(243, 244, 246);
            destHeaderLabel.Location = new Point(26, 108);
            destHeaderLabel.AutoSize = true;
            this.Controls.Add(destHeaderLabel);

            Label destDescLabel = new Label();
            destDescLabel.Text = "Setup will install REA-IDM into the directory below. To select a different location, click Browse.";
            destDescLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            destDescLabel.ForeColor = Color.FromArgb(156, 163, 175);
            destDescLabel.Location = new Point(26, 132);
            destDescLabel.Size = new Size(495, 20);
            this.Controls.Add(destDescLabel);

            // Path Input Box
            pathTextBox = new TextBox();
            pathTextBox.Text = installDir;
            pathTextBox.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            pathTextBox.ForeColor = Color.FromArgb(243, 244, 246);
            pathTextBox.BackColor = Color.FromArgb(32, 36, 43);
            pathTextBox.BorderStyle = BorderStyle.FixedSingle;
            pathTextBox.Location = new Point(26, 158);
            pathTextBox.Size = new Size(396, 26);
            pathTextBox.TextChanged += (s, e) => installDir = pathTextBox.Text.Trim();
            this.Controls.Add(pathTextBox);

            // Browse Button
            browseButton = new Button();
            browseButton.Text = "Browse...";
            browseButton.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            browseButton.ForeColor = Color.FromArgb(243, 244, 246);
            browseButton.BackColor = Color.FromArgb(32, 36, 43);
            browseButton.FlatStyle = FlatStyle.Flat;
            browseButton.FlatAppearance.BorderColor = Color.FromArgb(46, 52, 64);
            browseButton.Cursor = Cursors.Hand;
            browseButton.Location = new Point(430, 157);
            browseButton.Size = new Size(91, 28);
            browseButton.MouseEnter += (s, e) => browseButton.BackColor = Color.FromArgb(40, 45, 54);
            browseButton.MouseLeave += (s, e) => browseButton.BackColor = Color.FromArgb(32, 36, 43);
            browseButton.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Select Destination Folder for REA-IDM";
                    fbd.SelectedPath = pathTextBox.Text;
                    fbd.ShowNewFolderButton = true;
                    if (fbd.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(fbd.SelectedPath))
                    {
                        pathTextBox.Text = fbd.SelectedPath;
                        installDir = fbd.SelectedPath;
                    }
                }
            };
            this.Controls.Add(browseButton);

            // Space Requirement Label
            Label spaceLabel = new Label();
            spaceLabel.Text = "Space required: ~90 MB  |  Native zero-dependency Windows architecture";
            spaceLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            spaceLabel.ForeColor = Color.FromArgb(107, 114, 128);
            spaceLabel.Location = new Point(26, 194);
            spaceLabel.AutoSize = true;
            this.Controls.Add(spaceLabel);

            // Progress Bar
            progressBar = new ProgressBar();
            progressBar.Location = new Point(26, 226);
            progressBar.Size = new Size(495, 14);
            progressBar.Style = ProgressBarStyle.Continuous;
            this.Controls.Add(progressBar);

            // Status Label
            statusLabel = new Label();
            statusLabel.Text = "Ready to install. Click 'Install' to begin.";
            statusLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(156, 163, 175);
            statusLabel.Location = new Point(26, 248);
            statusLabel.Size = new Size(495, 20);
            this.Controls.Add(statusLabel);

            // Footer Panel for Modern Button Docking
            Panel footerPanel = new Panel();
            footerPanel.Dock = DockStyle.Bottom;
            footerPanel.Height = 64;
            footerPanel.BackColor = Color.FromArgb(24, 27, 32);

            Panel footerDivider = new Panel();
            footerDivider.Dock = DockStyle.Top;
            footerDivider.Height = 1;
            footerDivider.BackColor = Color.FromArgb(46, 52, 64);
            footerPanel.Controls.Add(footerDivider);

            // Install Button (Emerald Accent)
            installButton = new Button();
            installButton.Text = "Install";
            installButton.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            installButton.BackColor = Color.FromArgb(16, 185, 129);
            installButton.ForeColor = Color.White;
            installButton.FlatStyle = FlatStyle.Flat;
            installButton.FlatAppearance.BorderSize = 0;
            installButton.Cursor = Cursors.Hand;
            installButton.Size = new Size(110, 36);
            installButton.Location = new Point(300, 14);
            installButton.MouseEnter += (s, e) => installButton.BackColor = Color.FromArgb(5, 150, 105);
            installButton.MouseLeave += (s, e) => installButton.BackColor = Color.FromArgb(16, 185, 129);
            installButton.Click += (s, e) => StartInstallation();
            footerPanel.Controls.Add(installButton);

            // Cancel Button
            cancelButton = new Button();
            cancelButton.Text = "Cancel";
            cancelButton.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            cancelButton.BackColor = Color.FromArgb(32, 36, 43);
            cancelButton.ForeColor = Color.FromArgb(243, 244, 246);
            cancelButton.FlatStyle = FlatStyle.Flat;
            cancelButton.FlatAppearance.BorderColor = Color.FromArgb(46, 52, 64);
            cancelButton.Cursor = Cursors.Hand;
            cancelButton.Size = new Size(96, 36);
            cancelButton.Location = new Point(425, 14);
            cancelButton.MouseEnter += (s, e) => cancelButton.BackColor = Color.FromArgb(40, 45, 54);
            cancelButton.MouseLeave += (s, e) => cancelButton.BackColor = Color.FromArgb(32, 36, 43);
            cancelButton.Click += (s, e) => this.Close();
            footerPanel.Controls.Add(cancelButton);

            this.Controls.Add(footerPanel);
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

                    UpdateStatus("Unloading application binaries...", 35);
                    // Copy REA-IDM.exe
                    string mainExeSrc = Path.Combine(sourceDir, @"desktop-app\bin\REA-IDM.exe");
                    if (!File.Exists(mainExeSrc)) mainExeSrc = Path.Combine(sourceDir, "REA-IDM.exe");
                    if (File.Exists(mainExeSrc))
                    {
                        File.Copy(mainExeSrc, Path.Combine(installDir, "REA-IDM.exe"), true);
                    }

                    // Copy rea-idm-core.exe
                    string coreExeSrc = Path.Combine(sourceDir, @"desktop-app\bin\rea-idm-core.exe");
                    if (!File.Exists(coreExeSrc)) coreExeSrc = Path.Combine(sourceDir, "rea-idm-core.exe");
                    if (File.Exists(coreExeSrc))
                    {
                        File.Copy(coreExeSrc, Path.Combine(installDir, "rea-idm-core.exe"), true);
                    }

                    // Copy WebView2 runtime assemblies
                    string[] wvDlls = new string[] {
                        "Microsoft.Web.WebView2.Core.dll",
                        "Microsoft.Web.WebView2.WinForms.dll",
                        "WebView2Loader.dll"
                    };
                    foreach (string dll in wvDlls)
                    {
                        string dllSrc = Path.Combine(sourceDir, @"desktop-app\bin\" + dll);
                        if (!File.Exists(dllSrc)) dllSrc = Path.Combine(sourceDir, dll);
                        if (File.Exists(dllSrc))
                        {
                            File.Copy(dllSrc, Path.Combine(installDir, dll), true);
                        }
                    }

                    UpdateStatus("Unloading UI assets...", 55);
                    string uiSrc = Path.Combine(sourceDir, @"desktop-app\bin\ui");
                    if (!Directory.Exists(uiSrc)) uiSrc = Path.Combine(sourceDir, "ui");
                    if (Directory.Exists(uiSrc))
                    {
                        CopyDirectory(uiSrc, Path.Combine(installDir, "ui"));
                    }

                    UpdateStatus("Unloading bundled Chrome Extension...", 70);
                    string extSrc = Path.Combine(sourceDir, "chrome-extension");
                    if (Directory.Exists(extSrc))
                    {
                        CopyDirectory(extSrc, Path.Combine(installDir, "extension"));
                    }

                    UpdateStatus("Registering Chrome & Edge Native Messaging Host...", 85);
                    RegisterNativeHost();

                    UpdateStatus("Creating Desktop and Start Menu Shortcuts...", 95);
                    CreateShortcuts();

                    UpdateStatus("Installation Complete!", 100);

                    this.Invoke((MethodInvoker)delegate
                    {
                        // Prompt user for Chrome Extension installation
                        PromptExtensionInstall();

                        // Launch the native application
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
                        MessageBox.Show("Installation Error: " + ex.Message, "REA-IDM Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        installButton.Enabled = true;
                        cancelButton.Enabled = true;
                        pathTextBox.Enabled = true;
                        browseButton.Enabled = true;
                    });
                }
            });

            worker.IsBackground = true;
            worker.Start();
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

        private void RegisterNativeHost()
        {
            try
            {
                string manifestPath = Path.Combine(installDir, "com.rea.idm.json");
                string coreExe = Path.Combine(installDir, "rea-idm-core.exe");

                string manifestContent = "{\n" +
                    "  \"name\": \"com.rea.idm\",\n" +
                    "  \"description\": \"REA-IDM Native Messaging Host\",\n" +
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
                using (RegistryKey runKey = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
                {
                    if (runKey != null) runKey.SetValue("REA-IDM", "\"" + Path.Combine(installDir, "REA-IDM.exe") + "\"");
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

                    // Desktop Shortcut
                    string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    dynamic shortcutDesk = shell.CreateShortcut(Path.Combine(desktop, "REA-IDM.lnk"));
                    shortcutDesk.TargetPath = targetExe;
                    shortcutDesk.Description = "REA-IDM High-Speed Download Manager";
                    shortcutDesk.Save();

                    // Start Menu Shortcut
                    string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "REA-IDM");
                    Directory.CreateDirectory(startMenu);
                    dynamic shortcutMenu = shell.CreateShortcut(Path.Combine(startMenu, "REA-IDM.lnk"));
                    shortcutMenu.TargetPath = targetExe;
                    shortcutMenu.Save();
                }
            }
            catch { }
        }

        private void PromptExtensionInstall()
        {
            DialogResult result = MessageBox.Show(
                "Would you like to install the REA-IDM Chrome & Edge Extension to automatically capture downloads and video streams in your browser?",
                "REA-IDM Extension Setup",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );

            if (result == DialogResult.Yes)
            {
                string extFolder = Path.Combine(installDir, "extension");

                // Open Chrome Extensions page
                try
                {
                    Process.Start("chrome.exe", "chrome://extensions/");
                }
                catch
                {
                    try { Process.Start("msedge.exe", "edge://extensions/"); } catch { }
                }

                // Open the extension folder so user can simply drag/load it
                Process.Start("explorer.exe", extFolder);

                MessageBox.Show(
                    "To finish adding the extension:\n\n1. In your browser (chrome://extensions), toggle on 'Developer mode' (top right).\n2. Click 'Load unpacked' and select the folder currently open in Explorer:\n   " + extFolder + "\n\nREA-IDM will now automatically intercept browser downloads!",
                    "How to Enable Extension",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
        }
    }
}
