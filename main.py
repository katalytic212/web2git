import os
import requests
from bs4 import BeautifulSoup
from github import Github
import tkinter as tk
from tkinter import messagebox

# Função para fazer scraping e baixar o conteúdo do site
def clone_site_to_repo(url, repo_name, github_token):
    # Fazendo uma requisição ao site
    try:
        response = requests.get(url)
        response.raise_for_status()  # Verifica se a requisição foi bem-sucedida
    except requests.exceptions.RequestException as e:
        return f"Erro ao acessar o site: {e}"

    # Usando BeautifulSoup para parsear o HTML
    soup = BeautifulSoup(response.text, 'html.parser')

    # Cria um repositório no GitHub usando a API PyGithub
    g = Github(github_token)
    user = g.get_user()

    try:
        repo = user.create_repo(repo_name)
    except Exception as e:
        return f"Erro ao criar repositório no GitHub: {e}"

    # Criando arquivos a partir do conteúdo HTML
    os.makedirs("site_clone", exist_ok=True)
    with open("site_clone/index.html", "w", encoding="utf-8") as f:
        f.write(soup.prettify())

    # Subindo o conteúdo para o repositório
    repo.create_file("index.html", "Add index.html", soup.prettify(), branch="main")

    # Retorno de sucesso
    return f"Site clonado e enviado para o repositório '{repo_name}' com sucesso!"

# Função para a interface gráfica
def start_clone_process():
    url = entry_url.get()
    repo_name = entry_repo_name.get()
    github_token = entry_github_token.get()

    if not url or not repo_name or not github_token:
        messagebox.showerror("Erro", "Por favor, preencha todos os campos.")
        return

    result = clone_site_to_repo(url, repo_name, github_token)
    messagebox.showinfo("Resultado", result)

# Interface gráfica usando tkinter
root = tk.Tk()
root.title("Clone de Site para GitHub")

# Definindo os elementos da interface
label_url = tk.Label(root, text="URL do Site:")
label_url.pack()

entry_url = tk.Entry(root, width=50)
entry_url.pack()

label_repo_name = tk.Label(root, text="Nome do Repositório:")
label_repo_name.pack()

entry_repo_name = tk.Entry(root, width=50)
entry_repo_name.pack()

label_github_token = tk.Label(root, text="Token do GitHub:")
label_github_token.pack()

entry_github_token = tk.Entry(root, width=50)
entry_github_token.pack()

button_clone = tk.Button(root, text="Clonar e Enviar para o GitHub", command=start_clone_process)
button_clone.pack()

# Inicia a interface
root.mainloop()
