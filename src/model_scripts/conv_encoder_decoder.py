import torch.nn as nn
import torch.nn.functional as F
import torch

class ConvEncoderDecoder(nn.Module):
    def __init__(self):
        super(ConvEncoderDecoder, self).__init__()

        ### encoder layers ###
        # convolution
        self.encoder_conv1 = nn.Sequential(
            nn.Conv2d(3, 8, kernel_size=3, padding="same"),
            nn.ReLU()
        )
        # downsampling
        self.encoder_down1 = nn.Sequential(
            nn.Conv2d(8, 8, kernel_size=3, stride=2),
            nn.ReLU()
        )
        # convolution
        self.encoder_conv2 = nn.Sequential(
            nn.Conv2d(8, 16, kernel_size=3, padding="same"),
            nn.ReLU()
        )
        # downsampling
        self.encoder_down2 = nn.Sequential(
            nn.Conv2d(16, 16, kernel_size=3, stride=2),
            nn.ReLU()
        )
        

        ### decoder layers ###
        # convolution
        self.decoder_conv1 = nn.Sequential(
            nn.Conv2d(16, 16, kernel_size=3, padding="same"),
            nn.ReLU()
        )
        # upsampling
        self.decoder_up1 = nn.Sequential(
            nn.ConvTranspose2d(16, 16, kernel_size=3, stride=2),
            nn.ReLU()
        )
        # convolution
        self.decoder_conv2 = nn.Sequential(
            nn.Conv2d(32, 8, kernel_size=3, padding="same"),
            nn.ReLU()
        )
        # upsampling
        self.decoder_up2 = nn.Sequential(
            nn.ConvTranspose2d(16, 8, kernel_size=3, stride=2),
            nn.ReLU()
        )
        # convolutions
        self.decoder_conv3 = nn.Sequential(
            nn.Conv2d(16, 8, kernel_size=3, padding="same"),
            nn.ReLU(), 

            nn.Conv2d(8, 3, kernel_size=3, padding="same"),
            nn.Sigmoid()
        )

    def forward(self, x):
        ### encode ###
        x = self.encoder_conv1(x)
        skip1 = x
        x = self.encoder_down1(x)
        skip2 = x
        x = self.encoder_conv2(x)
        skip3 = x
        x = self.encoder_down2(x)
        
        ### decode ###
        x = self.decoder_conv1(x)
        x = self.decoder_up1(x)
        x = self.decoder_conv2(torch.cat([x, skip3], dim=1))
        x = self.decoder_up2(torch.cat([x, skip2], dim=1))
        x = F.pad(x, (0, 1, 0, 1), "constant", 0)               # Fix dimensions
        x = self.decoder_conv3(torch.cat([x, skip1], dim=1))
        
        return x