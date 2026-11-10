using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace FdmUninstaller
{
    public class UninstallProgram
    {
        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string targetDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            if (args != null && args.Length > 0 && Directory.Exists(args[0]))
            {
                targetDir = args[0].TrimEnd('\\');
            }

            Application.Run(new UninstallForm(targetDir));
        }
    }

    public class UninstallForm : Form
    {
        private string installDir;
        private CheckBox removeUserDataCheckBox;
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button uninstallButton;
        private Button cancelButton;

        public UninstallForm(string targetDir)
        {
            this.installDir = targetDir;
            this.Text = "FDM - Fluent Download Manager Uninstaller";
            this.Size = new Size(520, 340);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(17, 24, 39); // #111827
            this.ForeColor = Color.FromArgb(249, 250, 251);
            this.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            try { this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application; } catch { }

            // Header
            Panel headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 82;
            headerPanel.BackColor = Color.FromArgb(31, 41, 55); // #1F2937

            Label headerTitle = new Label();
            headerTitle.Text = "Uninstall FDM - Fluent Download Manager";
            headerTitle.Font = new Font("Segoe UI", 14f, FontStyle.Bold);
            headerTitle.ForeColor = Color.FromArgb(249, 250, 251);
            headerTitle.Location = new Point(24, 16);
            headerTitle.AutoSize = true;

            Label headerSub = new Label();
            headerSub.Text = "Remove application binaries, shortcuts, and browser hooks";
            headerSub.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            headerSub.ForeColor = Color.FromArgb(156, 163, 175);
            headerSub.Location = new Point(25, 46);
            headerSub.AutoSize = true;

            Panel headerAccent = new Panel();
            headerAccent.Dock = DockStyle.Bottom;
            headerAccent.Height = 3;
            headerAccent.BackColor = Color.FromArgb(220, 38, 38); // #DC2626

            headerPanel.Controls.Add(headerTitle);
            headerPanel.Controls.Add(headerSub);
            headerPanel.Controls.Add(headerAccent);
            this.Controls.Add(headerPanel);

            // Body
            Label locLabel = new Label();
            locLabel.Text = "Application folder to remove:\n" + installDir;
            locLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            locLabel.ForeColor = Color.FromArgb(209, 213, 219);
            locLabel.Location = new Point(24, 102);
            locLabel.Size = new Size(460, 38);
            this.Controls.Add(locLabel);

            removeUserDataCheckBox = new CheckBox();
            removeUserDataCheckBox.Text = "Also delete saved download history & WebView2 cache (your Downloads folder files remain safe)";
            removeUserDataCheckBox.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            removeUserDataCheckBox.ForeColor = Color.FromArgb(156, 163, 175);
            removeUserDataCheckBox.Location = new Point(24, 148);
            removeUserDataCheckBox.Size = new Size(460, 36);
            removeUserDataCheckBox.Checked = false;
            this.Controls.Add(removeUserDataCheckBox);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(24, 196);
            progressBar.Size = new Size(456, 14);
            progressBar.Style = ProgressBarStyle.Continuous;
            this.Controls.Add(progressBar);

            statusLabel = new Label();
            statusLabel.Text = "Ready to uninstall. Click 'Uninstall' to proceed.";
            statusLabel.Font = new Font("Segoe UI", 8.8f, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(156, 163, 175);
            statusLabel.Location = new Point(24, 218);
            statusLabel.Size = new Size(456, 20);
            this.Controls.Add(statusLabel);

            // Footer
            Panel footerPanel = new Panel();
            footerPanel.Dock = DockStyle.Bottom;
            footerPanel.Height = 60;
            footerPanel.BackColor = Color.FromArgb(31, 41, 55);

            Panel divider = new Panel();
            divider.Dock = DockStyle.Top;
            divider.Height = 1;
            divider.BackColor = Color.FromArgb(55, 65, 81);
            footerPanel.Controls.Add(divider);

            uninstallButton = new Button();
            uninstallButton.Text = "Uninstall";
            uninstallButton.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            uninstallButton.BackColor = Color.FromArgb(220, 38, 38); // #DC2626
            uninstallButton.ForeColor = Color.White;
            uninstallButton.FlatStyle = FlatStyle.Flat;
            uninstallButton.FlatAppearance.BorderSize = 0;
            uninstallButton.Cursor = Cursors.Hand;
            uninstallButton.Size = new Size(110, 34);
            uninstallButton.Location = new Point(272, 13);
            uninstallButton.Click += (s, e) => RunUninstall();
            footerPanel.Controls.Add(uninstallButton);

            cancelButton = new Button();
            cancelButton.Text = "Cancel";
            cancelButton.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            cancelButton.BackColor = Color.FromArgb(36, 47, 64);
            cancelButton.ForeColor = Color.FromArgb(249, 250, 251);
            cancelButton.FlatStyle = FlatStyle.Flat;
            cancelButton.FlatAppearance.BorderColor = Color.FromArgb(55, 65, 81);
            cancelButton.Cursor = Cursors.Hand;
            cancelButton.Size = new Size(92, 34);
            cancelButton.Location = new Point(392, 13);
            cancelButton.Click += (s, e) => this.Close();
            footerPanel.Controls.Add(cancelButton);

            this.Controls.Add(footerPanel);
        }

        private void RunUninstall()
        {
            uninstallButton.Enabled = false;
            cancelButton.Enabled = false;
            removeUserDataCheckBox.Enabled = false;
            bool removeCache = removeUserDataCheckBox.Checked;

            Thread worker = new Thread(() =>
            {
                try
                {
                    SetStatus("Stopping running FDM processes...", 20);
                    KillProcesses(new string[] { "REA-IDM", "rea-idm-core", "rea-idm" });

                    SetStatus("Removing Windows registry entries and browser hooks...", 45);
                    RemoveRegistryEntries();

                    SetStatus("Removing Desktop and Start Menu shortcuts...", 70);
                    RemoveShortcuts();

                    if (removeCache)
                    {
                        SetStatus("Removing local cache and download history...", 85);
                        RemoveUserCache();
                    }

                    SetStatus("Removing installed application files...", 95);
                    CleanupInstallDirectory();

                    SetStatus("Uninstallation complete!", 100);

                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show(
                            "FDM - Fluent Download Manager has been removed from your computer.\nYour downloaded files remain untouched.",
                            "Uninstall Complete",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                        ScheduleSelfDelete();
                        Application.Exit();
                    });
                }
                catch (Exception ex)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show("Uninstall encountered an error: " + ex.Message, "FDM Uninstaller", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        uninstallButton.Enabled = true;
                        cancelButton.Enabled = true;
                    });
                }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        private void SetStatus(string msg, int pct)
        {
            this.Invoke((MethodInvoker)delegate
            {
                statusLabel.Text = msg;
                progressBar.Value = Math.Min(100, pct);
            });
            Thread.Sleep(120);
        }

        private void KillProcesses(string[] names)
        {
            foreach (string name in names)
            {
                try
                {
                    Process[] procs = Process.GetProcessesByName(name);
                    foreach (Process p in procs)
                    {
                        try { p.Kill(); p.WaitForExit(1500); } catch { }
                    }
                }
                catch { }
            }
        }

        private void RemoveRegistryEntries()
        {
            try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Google\Chrome\NativeMessagingHosts\com.rea.idm", false); } catch { }
            try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Edge\NativeMessagingHosts\com.rea.idm", false); } catch { }
            try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\FDM-FluentDownloadManager", false); } catch { }
            try
            {
                using (RegistryKey runKey = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (runKey != null)
                    {
                        runKey.DeleteValue("FDM - Fluent Download Manager", false);
                        runKey.DeleteValue("REA-IDM", false);
                    }
                }
            }
            catch { }
        }

        private void RemoveShortcuts()
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string[] desktopLinks = { "FDM - Fluent Download Manager.lnk", "REA-IDM.lnk" };
                foreach (string lnk in desktopLinks)
                {
                    string p = Path.Combine(desktop, lnk);
                    if (File.Exists(p)) File.Delete(p);
                }

                string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                string[] menuDirs = { "FDM - Fluent Download Manager", "REA-IDM" };
                foreach (string dir in menuDirs)
                {
                    string full = Path.Combine(programs, dir);
                    if (Directory.Exists(full)) Directory.Delete(full, true);
                }
            }
            catch { }
        }

        private void RemoveUserCache()
        {
            try
            {
                string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string[] cacheDirs = { "FDM", "REA-IDM" };
                foreach (string dir in cacheDirs)
                {
                    string full = Path.Combine(localApp, dir);
                    if (Directory.Exists(full)) Directory.Delete(full, true);
                }
            }
            catch { }
        }

        private void CleanupInstallDirectory()
        {
            try
            {
                if (!Directory.Exists(installDir)) return;
                string selfExe = Path.GetFullPath(Application.ExecutablePath);

                foreach (string file in Directory.GetFiles(installDir))
                {
                    if (string.Equals(Path.GetFullPath(file), selfExe, StringComparison.OrdinalIgnoreCase)) continue;
                    try { File.Delete(file); } catch { }
                }

                foreach (string dir in Directory.GetDirectories(installDir))
                {
                    try { Directory.Delete(dir, true); } catch { }
                }
            }
            catch { }
        }

        private void ScheduleSelfDelete()
        {
            try
            {
                if (!Directory.Exists(installDir)) return;
                string cmd = "/c timeout /t 2 /nobreak >nul & rmdir /s /q \"" + installDir + "\"";
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", cmd);
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WorkingDirectory = Path.GetTempPath();
                Process.Start(psi);
            }
            catch { }
        }
    }
}

