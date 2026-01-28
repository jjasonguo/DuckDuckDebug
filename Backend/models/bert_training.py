import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from transformers import BertModel, BertTokenizer, get_linear_schedule_with_warmup
from transformers import RobertaTokenizer, RobertaConfig, RobertaModel

# Use MPS for Mac GPUs, fallback to CPU if MPS isn't available
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
print(f"Using device: {device}")

class BertEmbedder(nn.Module):
    def __init__(self, model_name="microsoft/codebert-base", dropout_prob=0.2, unfreeze_layers=4):
        super(BertEmbedder, self).__init__()
        # self.tokenizer = BertTokenizer.from_pretrained(model_name)
        # self.bert = BertModel.from_pretrained(model_name)
        self.tokenizer = RobertaTokenizer.from_pretrained(model_name)
        self.bert = RobertaModel.from_pretrained(model_name)
        self.dropout = nn.Dropout(dropout_prob)
        self.fc = nn.Linear(self.bert.config.hidden_size, 256)
        self.layer_norm = nn.LayerNorm(256)

        # Freeze all parameters first
        for param in self.bert.parameters():
            param.requires_grad = False

        # Unfreeze the last 'unfreeze_layers'
        for layer in self.bert.encoder.layer[-unfreeze_layers:]:
            for param in layer.parameters():
                param.requires_grad = True

    def forward(self, texts):
        # Tokenize in this forward pass so DataLoader can just yield raw strings
        inputs = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=128)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        outputs = self.bert(**inputs).last_hidden_state[:, 0, :]  # [CLS] token
        outputs = self.dropout(outputs)
        outputs = self.fc(outputs)
        outputs = self.layer_norm(outputs)
        return F.normalize(outputs, p=2, dim=1)
    
    @torch.no_grad()
    def embed_texts(self, texts):
        self.eval()
        inputs = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=128)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        outputs = self.bert(**inputs).last_hidden_state[:, 0, :]
        outputs = self.dropout(outputs)
        outputs = self.fc(outputs)
        outputs = self.layer_norm(outputs)
        return F.normalize(outputs, p=2, dim=1).cpu().tolist()

# Simple dataset for demonstration
class CoNaLaDataset(Dataset):
    def __init__(self, csv_file):
        import pandas as pd
        self.data = pd.read_csv(csv_file)
        self.nl_texts = self.data["nl_text"].tolist()
        self.code_texts = self.data["code_snippet"].tolist()

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        return self.nl_texts[idx], self.code_texts[idx]


def train_model(model, train_loader, val_loader, epochs=5, lr=2e-5, temperature=0.07):
    model.to(device)
    optimizer = optim.AdamW(model.parameters(), lr=lr)

    # Create a scheduler with warmup
    total_steps = len(train_loader) * epochs
    warmup_steps = int(0.1 * total_steps)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=warmup_steps,
        num_training_steps=total_steps
    )

    best_val_loss = float("inf")

    for epoch in range(1, epochs + 1):
        model.train()
        total_train_loss = 0.0

        for nl_texts, code_texts in train_loader:
            nl_embeddings = model(nl_texts)  # shape: (batch_size, 256)
            code_embeddings = model(code_texts)  # shape: (batch_size, 256)

            # (batch_size, batch_size)
            similarity_matrix = torch.matmul(nl_embeddings, code_embeddings.T) / temperature

            labels = torch.arange(similarity_matrix.size(0)).to(device)
            loss = F.cross_entropy(similarity_matrix, labels)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()

            total_train_loss += loss.item()

        avg_train_loss = total_train_loss / len(train_loader)
        val_loss = validate_model(model, val_loader, temperature)

        print(f"Epoch {epoch}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Loss: {val_loss:.4f}")

        # Save best model when validation loss improves
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), "best_model.pth")
            print("Model improved; saved to best_model.pth")

    # Save final model after all epochs complete
    torch.save(model.state_dict(), "final_model.pth")
    print("Training complete; saved final model to final_model.pth")

def validate_model(model, dataloader, temperature=0.07):
    model.eval()
    total_loss = 0.0

    with torch.no_grad():
        for nl_texts, code_texts in dataloader:
            nl_embeddings = model(nl_texts)
            code_embeddings = model(code_texts)
            similarity_matrix = torch.matmul(nl_embeddings, code_embeddings.T) / temperature
            labels = torch.arange(similarity_matrix.size(0)).to(device)
            loss = F.cross_entropy(similarity_matrix, labels)
            total_loss += loss.item()

    avg_loss = total_loss / len(dataloader)
    return avg_loss


if __name__ == "__main__":
    train_dataset = CoNaLaDataset("../models/train.csv")
    val_dataset = CoNaLaDataset("../models/valid.csv")

    # Potentially increase batch_size or use gradient accumulation
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)

    model = BertEmbedder(dropout_prob=0.2, unfreeze_layers=32)

    train_model(
        model,
        train_loader,
        val_loader,
        epochs=10,
        lr=1e-5,
        temperature=0.07
    )

