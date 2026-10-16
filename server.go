package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var rootDir string

type FileInfo struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Size int64  `json:"size"`
	Dir  bool   `json:"dir"`
}

func safeJoin(base, rel string) (string, error) {
	fmt.Println("join", base, rel)
	cleaned := filepath.Clean("/" + rel) // force absolute-style cleanup
	full := filepath.Join(base, cleaned)
	if !strings.HasPrefix(full, base) {
		return "", fmt.Errorf("access denied")
	}
	return full, nil
}

func handleList(w http.ResponseWriter, r *http.Request) {
	rel := r.URL.Query().Get("path")
	full, err := safeJoin(rootDir, rel)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	entries, err := os.ReadDir(full)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var results []FileInfo
	for _, e := range entries {
		info, _ := e.Info()
		results = append(results, FileInfo{
			Name: e.Name(),
			Path: filepath.Join(rel, e.Name()),
			Size: info.Size(),
			Dir:  e.IsDir(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	rel := r.URL.Query().Get("path")
	full, err := safeJoin(rootDir, rel)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	f, err := os.Open(full)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	defer f.Close()

	http.ServeContent(w, r, filepath.Base(full), fileModTime(f), f)
}

func fileModTime(f *os.File) (t time.Time) {
	info, err := f.Stat()
	if err == nil {
		t = info.ModTime()
	}
	return
}

func main() {
	flag.StringVar(&rootDir, "root", ".", "Root directory to serve")
	flag.Parse()

	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		panic(err)
	}
	rootDir = absRoot
	fmt.Println("Serving root:", rootDir)

	http.HandleFunc("/api/list", handleList)
	http.HandleFunc("/api/download", handleDownload)
	http.Handle("/_/", http.StripPrefix("/_/", http.FileServer(http.Dir("webui"))))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "webui/webui.html")
	})

	fmt.Println("Listening on http://0.0.0.0:8080 ...")
	http.ListenAndServe(":8080", nil)
}
