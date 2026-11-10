using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ReaIdm
{
    public class Program
    {
        private static Process daemonProcess = null;
        private static Mutex appMutex = null;

        [STAThread]
        public static void Main(string[] args)
        {
            bool startMinimized = HasArg(args, "--minimized");
            bool focusOnly = HasArg(args, "--focus");

            bool createdNew = false;
            appMutex = new Mutex(true, "REA_IDM_NATIVE_APP_MUTEX_V2", out createdNew);

            if (!createdNew)
            {
                try { ApiClient.PostJson("http://127.0.0.1:8765/api/app/focus", "{}"); } catch { }
                return;
            }

            if (focusOnly && IsPortOpen("127.0.0.1", 8765))
            {
                try { ApiClient.PostJson("http://127.0.0.1:8765/api/app/focus", "{}"); } catch { }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            StartBackendDaemon();

            Application.Run(new MainWindow(startMinimized));

            try { appMutex.ReleaseMutex(); } catch { }
        }

        private static bool HasArg(string[] args, string flag)
        {
            if (args == null) return false;
            for (int i = 0; i < args.Length; i++)
            {
                if (string.Equals(args[i], flag, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static void StartBackendDaemon()
        {
            try
            {
                if (IsPortOpen("127.0.0.1", 8765)) return;

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string coreExe = Path.Combine(baseDir, "rea-idm-core.exe");
                if (!File.Exists(coreExe)) coreExe = Path.Combine(baseDir, "rea-idm.exe");

                if (File.Exists(coreExe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = coreExe;
                    psi.Arguments = "--daemon --no-open";
                    psi.WorkingDirectory = baseDir;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    daemonProcess = Process.Start(psi);
                }

                for (int i = 0; i < 40; i++)
                {
                    if (IsPortOpen("127.0.0.1", 8765)) break;
                    Thread.Sleep(100);
                }
            }
            catch { }
        }

        public static bool IsPortOpen(string host, int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(180);
                    if (success)
                    {
                        client.EndConnect(result);
                        return true;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        public static void StopDaemon()
        {
            try
            {
                if (daemonProcess != null && !daemonProcess.HasExited)
                {
                    daemonProcess.Kill();
                }
            }
            catch { }
        }
    }

    public static class ApiClient
    {
        public static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

        public static string Get(string url)
        {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "GET";
            req.Timeout = 1500;
            req.Proxy = null;
            using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
            using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        public static string PostJson(string url, string jsonBody)
        {
            byte[] data = Encoding.UTF8.GetBytes(string.IsNullOrEmpty(jsonBody) ? "{}" : jsonBody);
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.ContentLength = data.Length;
            req.Timeout = 2000;
            req.Proxy = null;
            using (Stream reqStream = req.GetRequestStream())
            {
                reqStream.Write(data, 0, data.Length);
            }
            using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
            using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }
    }

    public class MainWindow : Form
    {
        private const string BASE_API = "http://127.0.0.1:8765/api";
        private WebView2 webView;
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private System.Windows.Forms.Timer statusTimer;
        private long lastFocusSignal = 0;
        private HashSet<string> notifiedIds = new HashSet<string>();
        private bool initialSyncDone = false;
        private string lastCompletedFile = null;
        private volatile bool polling = false;

        public MainWindow(bool startMinimized)
        {
            this.Text = "REA-IDM — Download Manager";
            this.Size = new Size(1240, 780);
            this.MinimumSize = new Size(920, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(17, 19, 23);
            this.Icon = SystemIcons.Application;

            InitTray();
            InitWebView();

            if (startMinimized)
            {
                this.WindowState = FormWindowState.Minimized;
                this.ShowInTaskbar = false;
                this.Hide();
            }

            statusTimer = new System.Windows.Forms.Timer();
            statusTimer.Interval = 1800;
            statusTimer.Tick += (s, e) => CheckDaemonEventsAsync();
            statusTimer.Start();

            this.Resize += MainWindow_Resize;
            this.FormClosing += MainWindow_FormClosing;
        }

        private async void InitWebView()
        {
            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            webView.DefaultBackgroundColor = Color.FromArgb(17, 19, 23);

            string userDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                @"REA-IDM\WebView2Data"
            );
            Directory.CreateDirectory(userDataDir);

            this.Controls.Add(webView);

            try
            {
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, userDataDir);
                await webView.EnsureCoreWebView2Async(env);

                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.Settings.IsZoomControlEnabled = false;

                webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
                webView.Source = new Uri("http://127.0.0.1:8765");
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Unable to initialize Microsoft Edge WebView2 Runtime: " + ex.Message,
                    "REA-IDM",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private void WebView_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string raw = e.TryGetWebMessageAsString();
                Dictionary<string, object> msg = ApiClient.Json.DeserializeObject(raw) as Dictionary<string, object>;
                if (msg == null) return;

                string type = msg.ContainsKey("type") && msg["type"] != null ? msg["type"].ToString() : "";
                if (type == "PICK_FOLDER")
                {
                    string reqId = msg.ContainsKey("reqId") && msg["reqId"] != null ? msg["reqId"].ToString() : "";
                    string initialDir = msg.ContainsKey("initialDir") && msg["initialDir"] != null ? msg["initialDir"].ToString() : "";

                    this.BeginInvoke((MethodInvoker)delegate
                    {
                        string chosen = "";
                        using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                        {
                            fbd.Description = "Select Download Folder";
                            if (!string.IsNullOrEmpty(initialDir) && Directory.Exists(initialDir))
                            {
                                fbd.SelectedPath = initialDir;
                            }
                            fbd.ShowNewFolderButton = true;
                            if (fbd.ShowDialog(this) == DialogResult.OK)
                            {
                                chosen = fbd.SelectedPath;
                            }
                        }

                        Dictionary<string, object> reply = new Dictionary<string, object>();
                        reply["type"] = "FOLDER_PICKED";
                        reply["reqId"] = reqId;
                        reply["path"] = chosen;
                        if (webView != null && webView.CoreWebView2 != null)
                        {
                            webView.CoreWebView2.PostWebMessageAsString(ApiClient.Json.Serialize(reply));
                        }
                    });
                }
            }
            catch { }
        }

        private void CheckDaemonEventsAsync()
        {
            if (polling) return;
            polling = true;

            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    string stJson = ApiClient.Get(BASE_API + "/status");
                    string dlJson = ApiClient.Get(BASE_API + "/downloads");
                    Dictionary<string, object> st = ApiClient.Json.DeserializeObject(stJson) as Dictionary<string, object>;
                    object[] list = ApiClient.Json.DeserializeObject(dlJson) as object[];

                    if (!this.IsDisposed && this.IsHandleCreated)
                    {
                        this.BeginInvoke((MethodInvoker)delegate
                        {
                            if (st != null && st.ContainsKey("focusSignal") && st["focusSignal"] != null)
                            {
                                long sig;
                                if (long.TryParse(st["focusSignal"].ToString(), out sig) && sig > 0)
                                {
                                    if (lastFocusSignal != 0 && sig != lastFocusSignal)
                                    {
                                        ShowWindow();
                                    }
                                    lastFocusSignal = sig;
                                }
                            }

                            if (list != null)
                            {
                                foreach (object obj in list)
                                {
                                    Dictionary<string, object> d = obj as Dictionary<string, object>;
                                    if (d == null) continue;
                                    string id = d.ContainsKey("id") && d["id"] != null ? d["id"].ToString() : "";
                                    string filename = d.ContainsKey("filename") && d["filename"] != null ? d["filename"].ToString() : "";
                                    string outPath = d.ContainsKey("outputPath") && d["outputPath"] != null ? d["outputPath"].ToString() : "";
                                    Dictionary<string, object> state = d.ContainsKey("state") ? d["state"] as Dictionary<string, object> : null;
                                    string status = state != null && state.ContainsKey("status") && state["status"] != null ? state["status"].ToString() : "";

                                    if (status == "completed" && !string.IsNullOrEmpty(id))
                                    {
                                        if (initialSyncDone && !notifiedIds.Contains(id))
                                        {
                                            lastCompletedFile = outPath;
                                            trayIcon.ShowBalloonTip(2500, "Download Complete", filename + " has finished downloading.", ToolTipIcon.Info);
                                        }
                                        notifiedIds.Add(id);
                                    }
                                }
                                initialSyncDone = true;
                            }
                        });
                    }
                }
                catch { }
                finally
                {
                    polling = false;
                }
            });
        }

        private void InitTray()
        {
            trayMenu = new ContextMenuStrip();
            trayMenu.Items.Add("Open REA-IDM", null, (s, e) => ShowWindow());
            trayMenu.Items.Add("Open Downloads Folder", null, (s, e) =>
            {
                try { ApiClient.PostJson(BASE_API + "/downloads/open-dir", "{}"); } catch { }
            });
            trayMenu.Items.Add("-");
            trayMenu.Items.Add("Exit REA-IDM", null, (s, e) => ExitApp());

            trayIcon = new NotifyIcon();
            trayIcon.Text = "REA-IDM — Download Manager";
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => ShowWindow();
            trayIcon.BalloonTipClicked += (s, e) =>
            {
                if (!string.IsNullOrEmpty(lastCompletedFile) && File.Exists(lastCompletedFile))
                {
                    try { Process.Start("explorer.exe", "/select,\"" + lastCompletedFile + "\""); } catch { }
                }
                else
                {
                    ShowWindow();
                }
            };
        }

        private void ShowWindow()
        {
            this.Show();
            this.ShowInTaskbar = true;
            if (this.WindowState == FormWindowState.Minimized)
            {
                this.WindowState = FormWindowState.Normal;
            }
            this.Activate();
            this.BringToFront();
        }

        private void MainWindow_Resize(object sender, EventArgs e)
        {
            if (this.WindowState == FormWindowState.Minimized)
            {
                this.Hide();
                trayIcon.ShowBalloonTip(1200, "REA-IDM Active", "Downloads continue in the system tray.", ToolTipIcon.Info);
            }
        }

        private void MainWindow_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();
                trayIcon.ShowBalloonTip(1200, "REA-IDM Minimized", "REA-IDM is running in the system tray.", ToolTipIcon.Info);
            }
        }

        private void ExitApp()
        {
            if (statusTimer != null) statusTimer.Stop();
            trayIcon.Visible = false;
            Program.StopDaemon();
            Application.Exit();
            Environment.Exit(0);
        }
    }
}
