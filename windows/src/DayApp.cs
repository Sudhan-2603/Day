using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace DayAssistant
{
    public class TrayApplicationContext : ApplicationContext
    {
        public TrayApplicationContext()
        {
            // Intentionally empty: manages lifetime via tray icon
        }
    }

    static class Program
    {
        private static NotifyIcon trayIcon;
        private static TcpListener tcpListener;
        private static Thread serverThread;
        private static volatile bool isRunning = true;
        private static string appRoot;
        private const int Port = 1420;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            AppDomain.CurrentDomain.UnhandledException += (s, e) => {
                try {
                    File.AppendAllText(
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "day_error.log"),
                        DateTime.Now.ToString() + ": " + e.ExceptionObject.ToString() + "\r\n"
                    );
                } catch { }
            };

            // Determine assets root directory
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            if (Directory.Exists(Path.Combine(exeDir, "Releases")))
                appRoot = Path.Combine(exeDir, "Releases");
            else if (Directory.Exists(Path.Combine(exeDir, "windows", "Releases")))
                appRoot = Path.Combine(exeDir, "windows", "Releases");
            else if (File.Exists(Path.Combine(exeDir, "index.html")))
                appRoot = exeDir;
            else
                appRoot = exeDir;

            // Start internal server if port 1420 is not already responding
            if (!IsPortResponding(Port))
            {
                StartSocketServer();
            }

            // Setup System Tray
            SetupTray();

            // Launch App Window
            OpenAppWindow("http://127.0.0.1:1420/");

            // Keep application running indefinitely in background
            Application.Run(new TrayApplicationContext());
        }

        private static bool IsPortResponding(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(300);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void StartSocketServer()
        {
            try
            {
                tcpListener = new TcpListener(IPAddress.Loopback, Port);
                tcpListener.Start();

                serverThread = new Thread(ListenLoop);
                serverThread.IsBackground = true;
                serverThread.Start();
            }
            catch (Exception ex)
            {
                try {
                    File.AppendAllText(
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "day_error.log"),
                        "StartSocketServer error: " + ex.Message + "\r\n"
                    );
                } catch { }
            }
        }

        private static void ListenLoop()
        {
            while (isRunning && tcpListener != null)
            {
                try
                {
                    TcpClient client = tcpListener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    if (!isRunning) break;
                }
            }
        }

        private static void HandleClient(object state)
        {
            TcpClient client = (TcpClient)state;
            if (client == null) return;

            try
            {
                using (client)
                using (NetworkStream stream = client.GetStream())
                {
                    stream.ReadTimeout = 4000;
                    byte[] buffer = new byte[8192];
                    int bytesRead = stream.Read(buffer, 0, buffer.Length);
                    if (bytesRead <= 0) return;

                    string request = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    string[] lines = request.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
                    if (lines.Length == 0) return;

                    string[] tokens = lines[0].Split(' ');
                    if (tokens.Length < 2) return;

                    string path = tokens[1].Split('?')[0];
                    if (path == "/" || string.IsNullOrEmpty(path))
                        path = "/index.html";

                    string relativePath = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                    string filePath = Path.Combine(appRoot, relativePath);

                    if (!File.Exists(filePath))
                    {
                        string altPath = Path.Combine(appRoot, Path.GetFileName(filePath));
                        if (File.Exists(altPath))
                            filePath = altPath;
                        else
                            filePath = Path.Combine(appRoot, "index.html");
                    }

                    if (File.Exists(filePath))
                    {
                        byte[] fileBytes = File.ReadAllBytes(filePath);
                        string mime = GetMimeType(filePath);
                        string header = string.Format(
                            "HTTP/1.1 200 OK\r\nContent-Type: {0}\r\nContent-Length: {1}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
                            mime, fileBytes.Length);
                        byte[] headerBytes = Encoding.UTF8.GetBytes(header);
                        stream.Write(headerBytes, 0, headerBytes.Length);
                        stream.Write(fileBytes, 0, fileBytes.Length);
                        stream.Flush();
                    }
                    else
                    {
                        byte[] notFound = Encoding.UTF8.GetBytes("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nNot Found");
                        stream.Write(notFound, 0, notFound.Length);
                        stream.Flush();
                    }
                }
            }
            catch { }
        }

        private static string GetMimeType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".ico": return "image/x-icon";
                case ".wav": return "audio/wav";
                case ".svg": return "image/svg+xml";
                default: return "application/octet-stream";
            }
        }

        private static void SetupTray()
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "Day — Personal AI Assistant";

            try
            {
                string exeDir = AppDomain.CurrentDomain.BaseDirectory;
                string iconPath = Path.Combine(exeDir, "icon.ico");
                if (!File.Exists(iconPath))
                    iconPath = Path.Combine(exeDir, "windows", "src-tauri", "icons", "icon.ico");

                if (File.Exists(iconPath))
                    trayIcon.Icon = new Icon(iconPath);
                else
                    trayIcon.Icon = SystemIcons.Application;
            }
            catch
            {
                trayIcon.Icon = SystemIcons.Application;
            }

            ContextMenu contextMenu = new ContextMenu();
            MenuItem titleItem = new MenuItem("Day — Personal AI Assistant");
            titleItem.Enabled = false;
            contextMenu.MenuItems.Add(titleItem);
            contextMenu.MenuItems.Add("-");

            contextMenu.MenuItems.Add(new MenuItem("🌐 Open Island (Capsule)", (s, e) => OpenAppWindow("http://127.0.0.1:1420/")));
            contextMenu.MenuItems.Add(new MenuItem("✨ Open Showcase (Emotions & Outfits)", (s, e) => OpenAppWindow("http://127.0.0.1:1420/day.html")));
            contextMenu.MenuItems.Add(new MenuItem("⚙️ Settings", (s, e) => OpenAppWindow("http://127.0.0.1:1420/settings.html")));
            contextMenu.MenuItems.Add("-");
            contextMenu.MenuItems.Add(new MenuItem("❌ Exit Day", (s, e) => ExitApp()));

            trayIcon.ContextMenu = contextMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => OpenAppWindow("http://127.0.0.1:1420/");
        }

        public static void OpenAppWindow(string url)
        {
            try
            {
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                if (!File.Exists(edgePath))
                    edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";

                if (File.Exists(edgePath))
                {
                    string dataDir = Path.Combine(Path.GetTempPath(), "DayAppProfile");
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = edgePath,
                        Arguments = string.Format("--app=\"{0}\" --window-size=1200,800 --user-data-dir=\"{1}\"", url, dataDir),
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                }
                else
                {
                    Process.Start(url);
                }
            }
            catch
            {
                Process.Start(url);
            }
        }

        private static void ExitApp()
        {
            isRunning = false;
            if (tcpListener != null)
            {
                try { tcpListener.Stop(); } catch { }
            }
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            Application.Exit();
        }
    }
}
