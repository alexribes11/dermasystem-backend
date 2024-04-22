from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from torchsummary import summary
import torch
import torchvision
import pandas as pd
import os
import PIL
from tqdm import tqdm
import numpy as np
import cv2
import matplotlib.pyplot as plt
from pathlib import Path
import sys

from conv_encoder_decoder import ConvEncoderDecoder

PATH_TO_INPUT_IMAGE = sys.argv[1]

device = 'cuda' if torch.cuda.is_available() else 'cpu'

def save_im_to_path(path_to_save_image, im):
    #
    path_to_save_image_with_number = path_to_save_image
    grayscale_image_already_exists = os.path.exists(path_to_save_image_with_number + '.jpg')
    if grayscale_image_already_exists:
        i = 2
        MAX_ITER = 100
        while (grayscale_image_already_exists) and (i < MAX_ITER):
            path_to_save_image_with_number = path_to_save_image + '_' + str(i)
            grayscale_image_already_exists = os.path.isfile(path_to_save_image_with_number + '.jpg')
            i += 1
    
    path_to_save_image_with_number = path_to_save_image_with_number + '.jpg'

    was_able_to_save = cv2.imwrite(path_to_save_image_with_number, im, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    print("was_able_to_save=", was_able_to_save, " for ", path_to_save_image_with_number)


# Define transformations
transform = transforms.Compose([
    transforms.Resize((512, 512)),
    transforms.CenterCrop((512, 512)),
    transforms.ToTensor()
])



# Create the encoder-decoder model
model = ConvEncoderDecoder().to(device)

print("OS.GETCWD=", os.getcwd())

pretrained = True
if pretrained:
    model.load_state_dict(
        torch.load("src/model_scripts/second_model.pth", map_location=torch.device(device))
    )

# Get example photo

# PATH_TO_INPUT_IMAGE = "./uploads/ISIC_01.jpeg"
NAME_OF_INPUT_IMAGE = Path(PATH_TO_INPUT_IMAGE).stem
hairy_img = PIL.Image.open(PATH_TO_INPUT_IMAGE)
hairy_img

# Pass the photo to the model as an input
hairy_img = transform(hairy_img)
hairy_img = hairy_img[:3, :, :]  # Fix dimension --> get rid of alpha channel
hairy_img = hairy_img[None, :, :, :] # Fix dimension --> batch size of 1
hairless_hat = model(hairy_img)
hairless_hat = torch.squeeze(hairless_hat) # Fix dimension --> Get rid of batch dimension

# Show the output picture
tensor_to_img = transforms.ToPILImage()
hairless_hat = tensor_to_img(hairless_hat)
hairless_hat

PATH_TO_OUTPUT_IMAGE_FOLDER = "src/outputImages/"
NAME_OF_TYPE_OF_IMAGE = "real_hair"

print("type(hairless_hat)=", type(hairless_hat))

# np.array VS np.asarray
hairless_hat_for_cv2 = cv2.cvtColor(np.asarray(hairless_hat), cv2.COLOR_RGB2BGR)
save_im_to_path(PATH_TO_OUTPUT_IMAGE_FOLDER + 'inpainted/' + NAME_OF_TYPE_OF_IMAGE + '/ip_' + NAME_OF_INPUT_IMAGE, hairless_hat_for_cv2)
